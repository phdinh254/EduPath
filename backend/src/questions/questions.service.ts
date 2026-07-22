import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ContentStatus,
  DifficultyLevel,
  Prisma,
  QuestionType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GeminiService } from '../ai/gemini.service';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CreateQuestionDto } from './dto/create-question.dto';
import { GenerateQuestionsDto } from './dto/generate-questions.dto';
import {
  buildSynthesizePrompt,
  synthesizeQuestion,
  type SynthesizedQuestion,
} from './ai-question.generator';

function assertValidTrueFalse(dto: {
  type: QuestionType;
  correctAnswer?: unknown;
}) {
  if (dto.type !== QuestionType.TRUE_FALSE) return;
  // Thang điểm lũy tiến (0.1/0.25/0.5/1) chỉ đúng chuẩn Bộ GD&ĐT khi câu có
  // đúng 4 ý — xem grading.utils.ts. Sai số ý sẽ âm thầm rơi về tính tuyến
  // tính, nên phải chặn ngay từ lúc tạo câu hỏi.
  const statements = (dto.correctAnswer as { statements?: unknown } | null)
    ?.statements;
  if (!Array.isArray(statements) || statements.length !== 4) {
    throw new BadRequestException(
      'Câu đúng/sai phải có đúng 4 ý (correctAnswer.statements)',
    );
  }
}

@Injectable()
export class QuestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gemini: GeminiService,
  ) {}

  // Gemini thật khi đã cấu hình; rơi về mẫu rule-based (synthesizeQuestion)
  // nếu chưa cấu hình hoặc Gemini lỗi — không để sự cố bên thứ ba chặn việc
  // sinh đề/câu hỏi.
  private async synthesize(params: {
    type: QuestionType;
    difficulty: DifficultyLevel;
    subjectName: string;
    topicName: string;
    index: number;
  }): Promise<SynthesizedQuestion> {
    if (!this.gemini.isConfigured()) {
      return synthesizeQuestion(params);
    }
    try {
      const prompt = buildSynthesizePrompt(params);
      return await this.gemini.generateJson<SynthesizedQuestion>(prompt);
    } catch {
      return synthesizeQuestion(params);
    }
  }

  // Nội dung do ADMIN tạo thủ công luôn vào thẳng kho dùng chung, vì ADMIN là
  // bên duyệt nội dung cuối cùng.
  create(user: JwtPayload, dto: CreateQuestionDto) {
    assertValidTrueFalse(dto);
    return this.prisma.question.create({
      data: {
        ...dto,
        options: dto.options as Prisma.InputJsonValue,
        correctAnswer: dto.correctAnswer as Prisma.InputJsonValue,
        createdById: user.sub,
        status: ContentStatus.APPROVED,
      },
    });
  }

  // AI sinh một lô câu hỏi mới (không sao chép nguyên văn đề/câu hỏi thật —
  // xem ai-question.generator.ts) và đưa vào hàng chờ để ADMIN kiểm duyệt nội
  // dung/bản quyền trước khi vào kho dùng chung chính thức.
  async generateBatch(user: JwtPayload, dto: GenerateQuestionsDto) {
    const topic = await this.prisma.topic.findUnique({
      where: { id: dto.topicId },
      include: { subject: true },
    });
    if (!topic || topic.subjectId !== dto.subjectId) {
      throw new NotFoundException('Không tìm thấy chuyên đề thuộc môn học này');
    }
    const created = await Promise.all(
      Array.from({ length: dto.count }, async (_, index) => {
        const synthesized = await this.synthesize({
          type: dto.type,
          difficulty: dto.difficulty,
          subjectName: topic.subject.name,
          topicName: topic.name,
          index,
        });
        return this.prisma.question.create({
          data: {
            subjectId: dto.subjectId,
            topicId: dto.topicId,
            type: dto.type,
            difficulty: dto.difficulty,
            content: synthesized.content,
            options: synthesized.options as Prisma.InputJsonValue,
            correctAnswer: synthesized.correctAnswer as Prisma.InputJsonValue,
            explanation: synthesized.explanation,
            createdById: user.sub,
            status: ContentStatus.PENDING_APPROVAL,
          },
        });
      }),
    );
    return created;
  }

  // Dùng nội bộ bởi ExamsService khi ghép đề tự động: lấy câu hỏi đã duyệt
  // sẵn có, và AI sinh bù ngay tại chỗ (tự động APPROVED, vì đề cần dùng ngay
  // — không có bước chờ admin) nếu ngân hàng câu hỏi chưa đủ.
  async pickOrSynthesizeQuestions(params: {
    subjectId: string;
    type: QuestionType;
    difficulty?: DifficultyLevel;
    count: number;
    creatorId: string;
  }) {
    const existing = await this.prisma.question.findMany({
      where: {
        subjectId: params.subjectId,
        type: params.type,
        difficulty: params.difficulty,
        status: ContentStatus.APPROVED,
      },
      take: params.count,
    });
    if (existing.length >= params.count) {
      return existing.slice(0, params.count);
    }

    const missing = params.count - existing.length;
    const topic = await this.prisma.topic.findFirst({
      where: { subjectId: params.subjectId },
      include: { subject: true },
    });
    if (!topic) {
      throw new BadRequestException(
        'Môn học chưa có chuyên đề nào để AI sinh câu hỏi',
      );
    }
    const difficulty = params.difficulty ?? 'KNOWLEDGE';
    const synthesizedRows = await Promise.all(
      Array.from({ length: missing }, async (_, i) => {
        const synthesized = await this.synthesize({
          type: params.type,
          difficulty,
          subjectName: topic.subject.name,
          topicName: topic.name,
          index: existing.length + i,
        });
        return this.prisma.question.create({
          data: {
            subjectId: params.subjectId,
            topicId: topic.id,
            type: params.type,
            difficulty,
            content: synthesized.content,
            options: synthesized.options as Prisma.InputJsonValue,
            correctAnswer: synthesized.correctAnswer as Prisma.InputJsonValue,
            explanation: synthesized.explanation,
            createdById: params.creatorId,
            // Sinh bù để dùng ngay trong đề — không qua hàng chờ duyệt, vì mục
            // tiêu là đề phải sẵn sàng tức thời. ADMIN vẫn có thể rút lại sau
            // qua reject() nếu phát hiện nội dung có vấn đề.
            status: ContentStatus.APPROVED,
          },
        });
      }),
    );
    return [...existing, ...synthesizedRows];
  }

  findAll(status?: ContentStatus) {
    return this.prisma.question.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const question = await this.prisma.question.findUnique({ where: { id } });
    if (!question) {
      throw new NotFoundException('Không tìm thấy câu hỏi');
    }
    return question;
  }

  async approve(id: string) {
    const question = await this.prisma.question.findUnique({ where: { id } });
    if (!question) {
      throw new NotFoundException('Không tìm thấy câu hỏi');
    }
    if (question.status !== ContentStatus.PENDING_APPROVAL) {
      throw new BadRequestException('Câu hỏi chưa được đề xuất phê duyệt');
    }
    return this.prisma.question.update({
      where: { id },
      data: { status: ContentStatus.APPROVED },
    });
  }

  // Cho phép rút cả câu hỏi đã APPROVED (kể cả loại AI tự sinh bù và tự động
  // publish ngay để kịp ghép đề) khỏi kho dùng chung nếu phát hiện vấn đề nội
  // dung/bản quyền sau khi đã công bố — không chỉ giới hạn ở PENDING_APPROVAL.
  async reject(id: string, adminId: string, reason?: string) {
    const question = await this.prisma.question.findUnique({ where: { id } });
    if (!question) {
      throw new NotFoundException('Không tìm thấy câu hỏi');
    }
    if (
      question.status !== ContentStatus.PENDING_APPROVAL &&
      question.status !== ContentStatus.APPROVED
    ) {
      throw new BadRequestException(
        'Câu hỏi đã ở trạng thái từ chối hoặc chưa được đề xuất phê duyệt',
      );
    }
    const updated = await this.prisma.question.update({
      where: { id },
      data: {
        status: ContentStatus.REJECTED,
        rejectReason: reason ?? null,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'REJECT_QUESTION',
        entityType: 'Question',
        entityId: id,
        metadata: reason ? { reason } : undefined,
      },
    });
    return updated;
  }
}
