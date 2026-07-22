import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AttemptStatus,
  ContentStatus,
  ExamCategory,
  Prisma,
  QuestionType,
  Role,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { QuestionsService } from '../questions/questions.service';
import { CreateExamDto } from './dto/create-exam.dto';
import { AddExamQuestionDto } from './dto/add-exam-question.dto';
import { GenerateExamDto } from './dto/generate-exam.dto';

const EXAM_DETAIL_INCLUDE = {
  sections: { orderBy: { order: 'asc' as const } },
  examQuestions: {
    include: { question: true },
    orderBy: { order: 'asc' as const },
  },
};

// Học sinh tự chọn đề để thi thử/ôn tập — không còn khái niệm lớp học, mọi đề
// đã tồn tại đều mở cho tất cả học sinh. Chỉ ADMIN quản lý nội dung đề thi.
@Injectable()
export class ExamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly questionsService: QuestionsService,
  ) {}

  // Tạo đề thủ công — chỉ ADMIN dùng (xem generateExam() cho luồng AI ghép đề
  // tự động, vốn là luồng chính).
  async create(user: JwtPayload, dto: CreateExamDto) {
    const category = dto.category ?? ExamCategory.THPT;
    if (category === ExamCategory.THPT && !dto.subjectId) {
      throw new BadRequestException('Đề THPT cần chỉ định subjectId');
    }
    return this.prisma.exam.create({
      data: {
        title: dto.title,
        category,
        subjectId: dto.subjectId,
        durationMinutes: dto.durationMinutes,
        createdById: user.sub,
      },
    });
  }

  // AI ghép đề hoàn chỉnh tự động: THPT lấy từ ngân hàng câu hỏi 1 môn (trắc
  // nghiệm 3 dạng hoặc tự luận Văn); ĐGNL chia nhiều section theo môn, tổng
  // thang điểm 150. Câu hỏi được lấy từ kho đã duyệt, AI sinh bù tức thời nếu
  // thiếu để đề luôn sẵn sàng ngay (xem QuestionsService.pickOrSynthesizeQuestions).
  async generateExam(user: JwtPayload, dto: GenerateExamDto) {
    if (dto.category === ExamCategory.DGNL) {
      return this.generateDgnlExam(user, dto);
    }
    return this.generateThptExam(user, dto);
  }

  private async generateThptExam(user: JwtPayload, dto: GenerateExamDto) {
    if (!dto.subjectId) {
      throw new BadRequestException('Đề THPT cần chỉ định subjectId');
    }

    const exam = await this.prisma.exam.create({
      data: {
        title: dto.title,
        category: ExamCategory.THPT,
        subjectId: dto.subjectId,
        durationMinutes: dto.durationMinutes,
        createdById: user.sub,
      },
    });

    let order = 1;
    const essayCount = dto.essayCount ?? 0;
    if (essayCount > 0) {
      // Văn: chỉ tự luận (Đọc hiểu + Viết), không trộn trắc nghiệm.
      const essayMaxScore = 10 / essayCount;
      const essays = await this.questionsService.pickOrSynthesizeQuestions({
        subjectId: dto.subjectId,
        type: QuestionType.ESSAY,
        count: essayCount,
        creatorId: user.sub,
      });
      for (const q of essays) {
        await this.prisma.examQuestion.create({
          data: {
            examId: exam.id,
            questionId: q.id,
            order: order++,
            maxScore: essayMaxScore,
          },
        });
      }
      return this.withDetails(exam.id);
    }

    const plan: Array<[QuestionType, number, number]> = [
      [QuestionType.MULTIPLE_CHOICE, dto.multipleChoiceCount ?? 24, 0.25],
      [QuestionType.TRUE_FALSE, dto.trueFalseCount ?? 4, 1],
      [QuestionType.SHORT_ANSWER, dto.shortAnswerCount ?? 0, 0.5],
    ];
    for (const [type, count, maxScore] of plan) {
      if (count <= 0) continue;
      const questions = await this.questionsService.pickOrSynthesizeQuestions({
        subjectId: dto.subjectId,
        type,
        count,
        creatorId: user.sub,
      });
      for (const q of questions) {
        await this.prisma.examQuestion.create({
          data: {
            examId: exam.id,
            questionId: q.id,
            order: order++,
            maxScore,
          },
        });
      }
    }
    return this.withDetails(exam.id);
  }

  private async generateDgnlExam(user: JwtPayload, dto: GenerateExamDto) {
    if (!dto.sections?.length) {
      throw new BadRequestException(
        'Đề ĐGNL cần khai báo sections (Toán/Ngôn ngữ/Khoa học...)',
      );
    }

    const exam = await this.prisma.exam.create({
      data: {
        title: dto.title,
        category: ExamCategory.DGNL,
        subjectId: null,
        durationMinutes: dto.durationMinutes,
        createdById: user.sub,
      },
    });

    let order = 1;
    for (const [i, section] of dto.sections.entries()) {
      const examSection = await this.prisma.examSection.create({
        data: {
          examId: exam.id,
          name: section.name,
          order: i + 1,
          maxScore: section.maxScore,
        },
      });
      const perQuestionScore = section.maxScore / section.questionCount;
      const questions = await this.questionsService.pickOrSynthesizeQuestions({
        subjectId: section.subjectId,
        type: QuestionType.MULTIPLE_CHOICE,
        count: section.questionCount,
        creatorId: user.sub,
      });
      for (const q of questions) {
        await this.prisma.examQuestion.create({
          data: {
            examId: exam.id,
            questionId: q.id,
            sectionId: examSection.id,
            order: order++,
            maxScore: perQuestionScore,
          },
        });
      }
    }
    return this.withDetails(exam.id);
  }

  private withDetails(examId: string) {
    return this.prisma.exam.findUnique({
      where: { id: examId },
      include: EXAM_DETAIL_INCLUDE,
    });
  }

  private async findExamOrThrow(id: string) {
    const exam = await this.prisma.exam.findUnique({ where: { id } });
    if (!exam) {
      throw new NotFoundException('Không tìm thấy đề thi');
    }
    return exam;
  }

  private assertAdminOnly(user: JwtPayload) {
    if (user.role !== Role.ADMIN) {
      throw new ForbiddenException('Chỉ ADMIN mới có quyền thao tác đề thi');
    }
  }

  // Không còn lớp học/tenant scoping — mọi đề đã tồn tại đều mở cho tất cả
  // học sinh tự chọn để thi thử/ôn tập.
  findAllForUser() {
    return this.prisma.exam.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string) {
    return this.findExamOrThrow(id);
  }

  async addQuestion(examId: string, user: JwtPayload, dto: AddExamQuestionDto) {
    this.assertAdminOnly(user);
    const exam = await this.findExamOrThrow(examId);

    const question = await this.prisma.question.findUnique({
      where: { id: dto.questionId },
    });
    if (!question) {
      throw new NotFoundException('Không tìm thấy câu hỏi');
    }
    if (question.status !== ContentStatus.APPROVED) {
      throw new ForbiddenException('Câu hỏi chưa ở kho dùng chung đã duyệt');
    }

    return this.prisma.examQuestion.create({
      data: {
        examId: exam.id,
        questionId: dto.questionId,
        sectionId: dto.sectionId,
        order: dto.order,
        maxScore: dto.maxScore,
      },
    });
  }

  async listQuestions(examId: string, user: JwtPayload) {
    const exam = await this.findOne(examId);
    const examQuestions = await this.prisma.examQuestion.findMany({
      where: { examId: exam.id },
      include: { question: true },
      orderBy: { order: 'asc' },
    });
    if (user.role === Role.STUDENT) {
      // Không lộ đáp án đúng cho học sinh khi đang làm bài
      return examQuestions.map(({ question, ...rest }) => ({
        ...rest,
        question: {
          id: question.id,
          type: question.type,
          difficulty: question.difficulty,
          content: question.content,
          options: question.options,
        },
      }));
    }
    return examQuestions;
  }

  async startAttempt(examId: string, user: JwtPayload) {
    await this.findExamOrThrow(examId);

    // Đọc rồi mới tạo có thể bị race nếu 2 request đến gần như đồng thời (double-click,
    // React StrictMode...). Dùng transaction isolation Serializable để Postgres tự phát
    // hiện xung đột; nếu bị serialization failure thì coi như đã có attempt, đọc lại.
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const inProgress = await tx.examAttempt.findFirst({
            where: {
              examId,
              studentId: user.sub,
              status: AttemptStatus.IN_PROGRESS,
            },
          });
          if (inProgress) {
            return inProgress;
          }
          return tx.examAttempt.create({
            data: { examId, studentId: user.sub },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch {
      const existing = await this.prisma.examAttempt.findFirst({
        where: {
          examId,
          studentId: user.sub,
          status: AttemptStatus.IN_PROGRESS,
        },
        orderBy: { createdAt: 'asc' },
      });
      if (existing) return existing;
      throw new BadRequestException(
        'Không thể bắt đầu lượt làm bài, vui lòng thử lại',
      );
    }
  }

  private async findAttemptOrThrow(id: string) {
    const attempt = await this.prisma.examAttempt.findUnique({ where: { id } });
    if (!attempt) {
      throw new NotFoundException('Không tìm thấy lượt làm bài');
    }
    return attempt;
  }

  async saveAnswer(
    attemptId: string,
    user: JwtPayload,
    questionId: string,
    response: unknown,
  ) {
    const attempt = await this.findAttemptOrThrow(attemptId);
    if (attempt.studentId !== user.sub) {
      throw new ForbiddenException('Đây không phải lượt làm bài của bạn');
    }
    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      throw new BadRequestException('Lượt làm bài đã kết thúc');
    }
    return this.prisma.answer.upsert({
      where: { attemptId_questionId: { attemptId, questionId } },
      create: {
        attemptId,
        questionId,
        response: response as Prisma.InputJsonValue,
      },
      update: { response: response as Prisma.InputJsonValue },
    });
  }

  async getAttempt(id: string, user: JwtPayload) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id },
      include: { answers: true, exam: true },
    });
    if (!attempt) {
      throw new NotFoundException('Không tìm thấy lượt làm bài');
    }
    if (user.role === Role.STUDENT && attempt.studentId !== user.sub) {
      throw new ForbiddenException('Bạn không có quyền xem lượt làm bài này');
    }
    return attempt;
  }

  // ADMIN xem toàn bộ lượt làm bài của một đề để theo dõi/thống kê.
  async listAttemptsForExam(examId: string, user: JwtPayload) {
    this.assertAdminOnly(user);
    await this.findExamOrThrow(examId);
    return this.prisma.examAttempt.findMany({
      where: { examId },
      include: {
        student: { select: { id: true, fullName: true, email: true } },
        score: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Đáp án đúng, giải thích và câu sai chỉ lộ ra sau khi bài đã được nộp/chấm —
  // không dùng chung với listQuestions() vốn phục vụ lúc học sinh đang làm bài.
  async getAttemptReview(attemptId: string, user: JwtPayload) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: {
          include: {
            examQuestions: {
              include: { question: true },
              orderBy: { order: 'asc' },
            },
          },
        },
        answers: true,
      },
    });
    if (!attempt) {
      throw new NotFoundException('Không tìm thấy lượt làm bài');
    }
    if (user.role === Role.STUDENT && attempt.studentId !== user.sub) {
      throw new ForbiddenException('Bạn không có quyền xem lượt làm bài này');
    }
    if (attempt.status === AttemptStatus.IN_PROGRESS) {
      throw new BadRequestException(
        'Bài làm chưa được nộp, chưa thể xem đáp án',
      );
    }

    // AI chấm và công bố điểm ngay lập tức (kể cả tự luận Văn) — ADMIN vẫn có
    // thể điều chỉnh lại sau qua GradingService.reviewEssay.
    const answersByQuestionId = new Map(
      attempt.answers.map((a) => [a.questionId, a]),
    );
    return attempt.exam.examQuestions.map((eq) => {
      const answer = answersByQuestionId.get(eq.questionId);
      return {
        questionId: eq.questionId,
        answerId: answer?.id ?? null,
        content: eq.question.content,
        type: eq.question.type,
        options: eq.question.options,
        correctAnswer: eq.question.correctAnswer,
        explanation: eq.question.explanation,
        maxScore: eq.maxScore,
        response: answer?.response ?? null,
        isCorrect: answer?.isCorrect ?? null,
        scoreAwarded: answer?.scoreAwarded ?? null,
        aiPreliminaryScore: answer?.aiPreliminaryScore ?? null,
        aiComment: answer?.aiComment ?? null,
        isAiReferenceOnly: answer?.isAiReferenceOnly ?? false,
        aiExplanation: answer?.aiExplanation ?? null,
      };
    });
  }
}
