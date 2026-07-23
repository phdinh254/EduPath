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

  // Số câu theo dạng × mức độ khó luôn lấy từ ExamStructure cố định của môn
  // (khai báo qua SubjectsService.upsertExamStructure) — admin không còn tự
  // gõ số lượng mỗi lần ghép đề, đảm bảo mọi đề cùng môn đúng 1 khuôn chung.
  private async generateThptExam(user: JwtPayload, dto: GenerateExamDto) {
    if (!dto.subjectId) {
      throw new BadRequestException('Đề THPT cần chỉ định subjectId');
    }

    const structure = await this.prisma.examStructure.findUnique({
      where: { subjectId: dto.subjectId },
      include: { items: { orderBy: { order: 'asc' } } },
    });
    if (!structure || structure.items.length === 0) {
      throw new BadRequestException(
        'Môn học chưa cấu hình cấu trúc đề — vào trang Môn học để khai báo trước khi ghép đề',
      );
    }

    const exam = await this.prisma.exam.create({
      data: {
        title: dto.title,
        category: ExamCategory.THPT,
        subjectId: dto.subjectId,
        durationMinutes: dto.durationMinutes ?? structure.durationMinutes,
        createdById: user.sub,
      },
    });

    let order = 1;
    for (const item of structure.items) {
      const questions = await this.questionsService.pickOrSynthesizeQuestions({
        subjectId: dto.subjectId,
        type: item.type,
        difficulty: item.difficulty,
        count: item.questionCount,
        creatorId: user.sub,
      });
      for (const q of questions) {
        await this.prisma.examQuestion.create({
          data: {
            examId: exam.id,
            questionId: q.id,
            order: order++,
            maxScore: item.maxScorePerQuestion,
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
    if (!dto.durationMinutes) {
      throw new BadRequestException('Đề ĐGNL cần chỉ định durationMinutes');
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
  // học sinh tự chọn để thi thử/ôn tập. Kèm số liệu khám phá đề (lượt làm,
  // điểm trung bình, lượt thích) để hiển thị dạng thẻ ở trang Đề thi.
  async findAllForUser(user: JwtPayload) {
    const exams = await this.prisma.exam.findMany({
      orderBy: { createdAt: 'desc' },
    });
    if (exams.length === 0) return [];

    const examIds = exams.map((e) => e.id);

    const [attemptCounts, scores, likeCounts, myLikes] = await Promise.all([
      this.prisma.examAttempt.groupBy({
        by: ['examId'],
        where: { examId: { in: examIds } },
        _count: { _all: true },
      }),
      this.prisma.score.findMany({
        where: { attempt: { examId: { in: examIds } } },
        select: { totalScore: true, attempt: { select: { examId: true } } },
      }),
      this.prisma.examLike.groupBy({
        by: ['examId'],
        where: { examId: { in: examIds } },
        _count: { _all: true },
      }),
      user.role === Role.STUDENT
        ? this.prisma.examLike.findMany({
            where: { examId: { in: examIds }, studentId: user.sub },
            select: { examId: true },
          })
        : Promise.resolve<{ examId: string }[]>([]),
    ]);

    const attemptCountByExam = new Map(
      attemptCounts.map((a) => [a.examId, a._count._all]),
    );
    const likeCountByExam = new Map(
      likeCounts.map((l) => [l.examId, l._count._all]),
    );
    const likedExamIds = new Set(myLikes.map((l) => l.examId));

    const scoreSumByExam = new Map<string, { sum: number; count: number }>();
    for (const score of scores) {
      const examId = score.attempt.examId;
      const entry = scoreSumByExam.get(examId) ?? { sum: 0, count: 0 };
      entry.sum += score.totalScore;
      entry.count += 1;
      scoreSumByExam.set(examId, entry);
    }

    return exams.map((exam) => {
      const scoreEntry = scoreSumByExam.get(exam.id);
      return {
        ...exam,
        attemptCount: attemptCountByExam.get(exam.id) ?? 0,
        likeCount: likeCountByExam.get(exam.id) ?? 0,
        liked: likedExamIds.has(exam.id),
        avgScore: scoreEntry
          ? Math.round((scoreEntry.sum / scoreEntry.count) * 10) / 10
          : null,
      };
    });
  }

  // Học sinh bấm "thích" một đề thi khi đang khám phá đề — không ảnh hưởng
  // đến việc làm bài, chỉ phục vụ hiển thị lượt thích.
  async toggleLike(examId: string, user: JwtPayload) {
    await this.findExamOrThrow(examId);
    const existing = await this.prisma.examLike.findUnique({
      where: { examId_studentId: { examId, studentId: user.sub } },
    });
    if (existing) {
      await this.prisma.examLike.delete({ where: { id: existing.id } });
    } else {
      await this.prisma.examLike.create({
        data: { examId, studentId: user.sub },
      });
    }
    const likeCount = await this.prisma.examLike.count({ where: { examId } });
    return { liked: !existing, likeCount };
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

  // Đồng hồ đếm giờ ở frontend chỉ mang tính hiển thị — học sinh có thể tắt
  // tab/sửa client để bỏ qua nó. Chặn ở đây (thời điểm duy nhất còn ghi dữ
  // liệu mới vào bài làm) là nơi thực thi giới hạn thời gian thật sự: quá
  // giờ thì không cho lưu thêm câu trả lời nữa, nhưng vẫn cho phép nộp bài
  // (submitAttempt) để chấm điểm trên những gì đã lưu trước khi hết giờ.
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
    const exam = await this.prisma.exam.findUnique({
      where: { id: attempt.examId },
      select: { durationMinutes: true },
    });
    const deadline =
      attempt.startedAt.getTime() + (exam?.durationMinutes ?? 0) * 60_000;
    if (Date.now() > deadline) {
      throw new BadRequestException(
        'Đã hết thời gian làm bài, không thể lưu thêm câu trả lời — hãy nộp bài',
      );
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
