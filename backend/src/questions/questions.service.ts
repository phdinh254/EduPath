import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import {
  ContentStatus,
  DifficultyLevel,
  Prisma,
  QuestionSource,
  QuestionType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GeminiService } from '../ai/gemini.service';
import {
  GENERATE_QUESTIONS_QUEUE,
  type GenerateQuestionsJobData,
} from './generate-questions-queue.constants';
import { toPaginatedResult, toSkipTake } from '../common/pagination.util';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CreateQuestionDto } from './dto/create-question.dto';
import { GenerateQuestionsDto } from './dto/generate-questions.dto';
import { ParseExamImportDto } from './dto/parse-exam-import.dto';
import { CommitImportedQuestionsDto } from './dto/commit-imported-questions.dto';
import {
  buildParseImportPrompt,
  type ParsedImportQuestion,
} from './ai-question-import.parser';
import {
  buildSynthesizePrompt,
  synthesizeQuestion,
  type SynthesizedQuestion,
} from './ai-question.generator';

// Tăng khi sửa nội dung prompt sinh câu hỏi (buildSynthesizePrompt) — lưu vào
// Question.generationPromptVersion để truy vết câu cũ được sinh bằng bản nào.
const QUESTION_GENERATION_PROMPT_VERSION = 'question-gen-v1';
const RULE_BASED_MODEL_LABEL = 'RULE_BASED_TEMPLATE';

// Kiểm tra cấu trúc tối thiểu trước khi đưa câu AI sinh vào hàng chờ duyệt —
// không đánh giá được "chất lượng học thuật" (việc đó dành cho ADMIN), nhưng
// chặn được JSON hỏng/thiếu trường mà Gemini đôi khi trả về.
function isStructurallyValid(
  type: QuestionType,
  q: SynthesizedQuestion,
): boolean {
  if (!q.content || q.content.trim().length < 5) return false;
  if (type === QuestionType.ESSAY) return true;
  if (!q.explanation || q.explanation.trim().length === 0) return false;

  if (type === QuestionType.MULTIPLE_CHOICE) {
    const options = q.options;
    const correct = (q.correctAnswer as { index?: number } | null)?.index;
    return (
      Array.isArray(options) &&
      options.length === 4 &&
      options.every((o) => typeof o === 'string' && o.trim().length > 0) &&
      typeof correct === 'number' &&
      correct >= 0 &&
      correct <= 3
    );
  }
  if (type === QuestionType.TRUE_FALSE) {
    const options = q.options;
    const statements = (q.correctAnswer as { statements?: unknown } | null)
      ?.statements;
    return (
      Array.isArray(options) &&
      options.length === 4 &&
      Array.isArray(statements) &&
      statements.length === 4 &&
      statements.every((s) => typeof s === 'boolean')
    );
  }
  if (type === QuestionType.SHORT_ANSWER) {
    const value = (q.correctAnswer as { value?: string } | null)?.value;
    return typeof value === 'string' && value.trim().length > 0;
  }
  return false;
}

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
    @InjectQueue(GENERATE_QUESTIONS_QUEUE)
    private readonly generateQuestionsQueue: Queue<GenerateQuestionsJobData>,
  ) {}

  // Gemini thật khi đã cấu hình; rơi về mẫu rule-based (synthesizeQuestion)
  // nếu chưa cấu hình hoặc Gemini lỗi — không để sự cố bên thứ ba chặn việc
  // sinh câu hỏi. Trả kèm tên model thực sự dùng để ghi vào
  // Question.generationModel (truy vết chất lượng theo nguồn).
  private async synthesize(params: {
    type: QuestionType;
    difficulty: DifficultyLevel;
    subjectName: string;
    topicName: string;
    index: number;
  }): Promise<{ question: SynthesizedQuestion; model: string }> {
    if (!this.gemini.isConfigured()) {
      return {
        question: synthesizeQuestion(params),
        model: RULE_BASED_MODEL_LABEL,
      };
    }
    try {
      const prompt = buildSynthesizePrompt(params);
      const question =
        await this.gemini.generateJson<SynthesizedQuestion>(prompt);
      return { question, model: this.gemini.getModelName() };
    } catch {
      return {
        question: synthesizeQuestion(params),
        model: RULE_BASED_MODEL_LABEL,
      };
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
        source: QuestionSource.ADMIN_MANUAL,
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
    const results = await Promise.all(
      Array.from({ length: dto.count }, async (_, index) => {
        const { question: synthesized, model } = await this.synthesize({
          type: dto.type,
          difficulty: dto.difficulty,
          subjectName: topic.subject.name,
          topicName: topic.name,
          index,
        });
        if (!isStructurallyValid(dto.type, synthesized)) return null;
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
            source: QuestionSource.AI_GENERATED,
            generationModel: model,
            generationPromptVersion: QUESTION_GENERATION_PROMPT_VERSION,
          },
        });
      }),
    );
    return results.filter((q) => q !== null);
  }

  // Sinh bù câu còn thiếu vào HÀNG CHỜ DUYỆT (không bao giờ APPROVED thẳng) —
  // được GenerateQuestionsProcessor gọi khi xử lý job trong hàng đợi (xem
  // pickOrSynthesizeQuestions). Không trả về để dùng ngay, chỉ để ADMIN có
  // sẵn nội dung chờ xem xét thay vì phải tự soạn từ đầu.
  async processGenerateQuestionsJob(
    params: GenerateQuestionsJobData,
  ): Promise<number> {
    const rows = await Promise.all(
      Array.from({ length: params.count }, async (_, i) => {
        const { question: synthesized, model } = await this.synthesize({
          type: params.type,
          difficulty: params.difficulty,
          subjectName: params.subjectName,
          topicName: params.topicName,
          index: params.startIndex + i,
        });
        if (!isStructurallyValid(params.type, synthesized)) return null;
        return this.prisma.question.create({
          data: {
            subjectId: params.subjectId,
            topicId: params.topicId,
            type: params.type,
            difficulty: params.difficulty,
            content: synthesized.content,
            options: synthesized.options as Prisma.InputJsonValue,
            correctAnswer: synthesized.correctAnswer as Prisma.InputJsonValue,
            explanation: synthesized.explanation,
            createdById: params.creatorId,
            // KHÔNG tự động APPROVED — nội dung AI sinh luôn phải qua ADMIN
            // duyệt trước khi vào kho dùng chung (xem P0 issue #3).
            status: ContentStatus.PENDING_APPROVAL,
            source: QuestionSource.AI_GENERATED,
            generationModel: model,
            generationPromptVersion: QUESTION_GENERATION_PROMPT_VERSION,
          },
        });
      }),
    );
    return rows.filter((q) => q !== null).length;
  }

  // Dùng nội bộ bởi ExamsService khi ghép đề tự động (chỉ ADMIN gọi được, xem
  // ExamsController.generate): lấy câu hỏi đã duyệt sẵn có. Nếu chưa đủ, AI
  // sinh bù vào hàng chờ duyệt để ADMIN xử lý, nhưng đề KHÔNG được ghép bằng
  // nội dung chưa duyệt — báo lỗi thiếu dữ liệu thay vì xuất bản câu giả (xem
  // P0 issue #3). excludeIds dùng để tránh chọn trùng câu hỏi giữa các
  // item/section khác nhau của CÙNG một đề khi chúng trỏ tới cùng subjectId
  // (vd. ĐGNL có 2 section cùng dùng Toán).
  async pickOrSynthesizeQuestions(params: {
    subjectId: string;
    type: QuestionType;
    difficulty?: DifficultyLevel;
    count: number;
    creatorId: string;
    excludeIds?: string[];
  }) {
    const existing = await this.prisma.question.findMany({
      where: {
        subjectId: params.subjectId,
        type: params.type,
        difficulty: params.difficulty,
        status: ContentStatus.APPROVED,
        ...(params.excludeIds?.length
          ? { id: { notIn: params.excludeIds } }
          : {}),
      },
      // Ưu tiên câu hỏi nhập từ đề thật (IMPORTED_REAL đứng trước trong khai
      // báo enum) trước khi dùng câu AI tự sinh — xem QuestionSource.
      orderBy: { source: 'asc' },
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
    const difficulty = params.difficulty ?? DifficultyLevel.KNOWLEDGE;
    let queued = false;
    if (topic) {
      // Xếp hàng chạy nền qua BullMQ thay vì chờ tại đây — kết quả không
      // được dùng cho lần ghép đề này (đã throw lỗi ngay bên dưới), chỉ để
      // ADMIN có sẵn nội dung chờ duyệt cho lần sau, nên không cần đợi.
      await this.generateQuestionsQueue.add('generate', {
        subjectId: params.subjectId,
        topicId: topic.id,
        topicName: topic.name,
        subjectName: topic.subject.name,
        type: params.type,
        difficulty,
        count: missing,
        creatorId: params.creatorId,
        startIndex: existing.length,
      });
      queued = true;
    }
    throw new BadRequestException(
      `Không đủ câu hỏi đã duyệt cho môn học này (cần ${params.count}, hiện có ${existing.length})` +
        (queued
          ? ' — AI đang sinh thêm câu vào hàng chờ duyệt trong nền, vào trang Câu hỏi kiểm tra lại sau ít phút rồi ghép lại đề.'
          : ' — chưa có chuyên đề nào của môn này để AI sinh bù, hãy bổ sung câu hỏi thủ công.'),
    );
  }

  // Dùng bởi ExamsService.generateTopicPractice — luyện tập nhanh đúng một
  // chuyên đề do STUDENT tự bấm. KHÔNG được sinh câu hỏi mới ở đây: học sinh
  // không có quyền kích hoạt việc tạo nội dung dùng chung (xem P0 issue #3)
  // — chỉ lấy từ những câu ADMIN đã duyệt sẵn. Nếu thiếu, báo lỗi rõ ràng
  // thay vì âm thầm xuất bản câu giả.
  async pickQuestionsByTopic(params: {
    topicId: string;
    count: number;
    creatorId: string;
  }) {
    const existing = await this.prisma.question.findMany({
      where: { topicId: params.topicId, status: ContentStatus.APPROVED },
      orderBy: { source: 'asc' },
      take: params.count,
    });
    if (existing.length === 0) {
      throw new BadRequestException(
        'Chuyên đề này chưa có câu hỏi nào đã được duyệt để luyện tập — hãy thử chuyên đề khác hoặc quay lại sau',
      );
    }
    return existing;
  }

  // Bước 1/2 của luồng nhập đề thi thật: AI tách văn bản thô ADMIN dán vào
  // thành danh sách câu hỏi có cấu trúc — CHỈ trả về bản nháp, KHÔNG ghi vào
  // CSDL. ADMIN phải rà soát/sửa (đặc biệt gán đúng topicId) rồi mới gọi
  // commitImportedQuestions() để thực sự lưu vào kho.
  async parseImportDraft(
    dto: ParseExamImportDto,
  ): Promise<ParsedImportQuestion[]> {
    if (!this.gemini.isConfigured()) {
      throw new BadRequestException(
        'Tính năng nhập đề thi thật cần cấu hình GEMINI_API_KEY trên máy chủ',
      );
    }
    const [subject, topics] = await Promise.all([
      this.prisma.subject.findUnique({ where: { id: dto.subjectId } }),
      this.prisma.topic.findMany({
        where: { subjectId: dto.subjectId },
        select: { name: true },
      }),
    ]);
    if (!subject) {
      throw new NotFoundException('Không tìm thấy môn học');
    }

    const prompt = buildParseImportPrompt({
      subjectName: subject.name,
      topicNames: topics.map((t) => t.name),
      rawText: dto.rawText,
    });
    let parsed: ParsedImportQuestion[];
    try {
      parsed = await this.gemini.generateJson<ParsedImportQuestion[]>(prompt);
    } catch {
      // Vượt ngân sách/ngày, timeout, hoặc Gemini lỗi.
      throw new ServiceUnavailableException(
        'AI đang tạm thời không khả dụng, vui lòng thử lại sau ít phút',
      );
    }
    if (!Array.isArray(parsed)) {
      throw new BadRequestException(
        'AI không tách được câu hỏi hợp lệ từ văn bản đã cung cấp — hãy thử lại với văn bản rõ ràng hơn',
      );
    }
    return parsed;
  }

  // Bước 2/2: ADMIN đã rà soát bản nháp và gán topicId thật — ghi thẳng vào
  // kho dùng chung (APPROVED, source=IMPORTED_REAL) vì ADMIN là người duyệt
  // cuối cùng, giống hệt create() thủ công.
  async commitImportedQuestions(
    user: JwtPayload,
    dto: CommitImportedQuestionsDto,
  ) {
    const topicIds = [...new Set(dto.questions.map((q) => q.topicId))];
    const validTopics = await this.prisma.topic.findMany({
      where: { id: { in: topicIds }, subjectId: dto.subjectId },
      select: { id: true },
    });
    const validTopicIds = new Set(validTopics.map((t) => t.id));
    for (const q of dto.questions) {
      if (!validTopicIds.has(q.topicId)) {
        throw new BadRequestException(
          `Chuyên đề ${q.topicId} không thuộc môn học này`,
        );
      }
      assertValidTrueFalse(q);
    }

    return this.prisma.question.createMany({
      data: dto.questions.map((q) => ({
        subjectId: dto.subjectId,
        topicId: q.topicId,
        type: q.type,
        difficulty: q.difficulty,
        content: q.content,
        options: (q.options ?? null) as Prisma.InputJsonValue,
        correctAnswer: (q.correctAnswer ?? null) as Prisma.InputJsonValue,
        explanation: q.explanation,
        createdById: user.sub,
        status: ContentStatus.APPROVED,
        source: QuestionSource.IMPORTED_REAL,
      })),
    });
  }

  async findAll(status?: ContentStatus, page?: number, limit?: number) {
    const where = status ? { status } : undefined;
    const {
      skip,
      take,
      page: safePage,
      limit: safeLimit,
    } = toSkipTake(page, limit);
    const [data, total] = await Promise.all([
      this.prisma.question.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.question.count({ where }),
    ]);
    return toPaginatedResult(data, total, safePage, safeLimit);
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
