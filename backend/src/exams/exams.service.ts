import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AttemptStatus,
  ContentStatus,
  Prisma,
  QuestionType,
  Role,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CreateExamDto } from './dto/create-exam.dto';
import { AddExamQuestionDto } from './dto/add-exam-question.dto';

@Injectable()
export class ExamsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: JwtPayload, dto: CreateExamDto) {
    const isAdmin = user.role === Role.ADMIN;
    if (!isAdmin && !user.tenantId) {
      throw new ForbiddenException('Giáo viên chưa có tenant');
    }
    if (dto.classId) {
      const klass = await this.prisma.class.findUnique({
        where: { id: dto.classId },
      });
      if (!klass) {
        throw new NotFoundException('Không tìm thấy lớp học');
      }
      if (!isAdmin && klass.tenantId !== user.tenantId) {
        throw new ForbiddenException('Lớp học này không thuộc tenant của bạn');
      }
    }
    return this.prisma.exam.create({
      data: {
        title: dto.title,
        subjectId: dto.subjectId,
        durationMinutes: dto.durationMinutes,
        classId: dto.classId,
        tenantId: isAdmin ? null : user.tenantId,
        createdById: user.sub,
      },
    });
  }

  private async findExamOrThrow(id: string) {
    const exam = await this.prisma.exam.findUnique({ where: { id } });
    if (!exam) {
      throw new NotFoundException('Không tìm thấy đề thi');
    }
    return exam;
  }

  private assertManageable(
    exam: { tenantId: string | null },
    user: JwtPayload,
  ) {
    if (user.role === Role.ADMIN) return;
    if (exam.tenantId !== user.tenantId) {
      throw new ForbiddenException('Bạn không có quyền quản lý đề thi này');
    }
  }

  async findAllForUser(user: JwtPayload) {
    if (user.role === Role.ADMIN) {
      return this.prisma.exam.findMany({ orderBy: { createdAt: 'desc' } });
    }
    if (user.role === Role.TEACHER) {
      return this.prisma.exam.findMany({
        where: { tenantId: user.tenantId },
        orderBy: { createdAt: 'desc' },
      });
    }
    // Học sinh: đề chính thức/dùng chung + đề của các lớp mình đang tham gia
    const classIds = (
      await this.prisma.studentClass.findMany({
        where: { studentId: user.sub, status: 'ACTIVE' },
        select: { classId: true },
      })
    ).map((sc) => sc.classId);
    return this.prisma.exam.findMany({
      where: { OR: [{ tenantId: null }, { classId: { in: classIds } }] },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, user: JwtPayload) {
    const exam = await this.findExamOrThrow(id);
    if (user.role !== Role.STUDENT) {
      this.assertManageable(exam, user);
    } else {
      await this.assertStudentCanAccess(exam, user.sub);
    }
    return exam;
  }

  private async assertStudentCanAccess(
    exam: { id: string; tenantId: string | null; classId: string | null },
    studentId: string,
  ) {
    if (exam.tenantId === null) return; // đề chính thức/dùng chung
    if (!exam.classId) {
      throw new ForbiddenException('Đề thi chưa được gán cho lớp học');
    }
    // Phòng thủ lớp hai: đối chiếu lớp thực sự thuộc đúng tenant của đề thi,
    // phòng trường hợp dữ liệu classId/tenantId không nhất quán do lỗi khác.
    const klass = await this.prisma.class.findUnique({
      where: { id: exam.classId },
    });
    if (!klass || klass.tenantId !== exam.tenantId) {
      throw new ForbiddenException('Đề thi chưa được gán cho lớp học');
    }
    const membership = await this.prisma.studentClass.findUnique({
      where: { studentId_classId: { studentId, classId: exam.classId } },
    });
    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenException(
        'Bạn không thuộc lớp học được giao đề thi này',
      );
    }
  }

  async addQuestion(examId: string, user: JwtPayload, dto: AddExamQuestionDto) {
    const exam = await this.findExamOrThrow(examId);
    this.assertManageable(exam, user);

    const question = await this.prisma.question.findUnique({
      where: { id: dto.questionId },
    });
    if (!question) {
      throw new NotFoundException('Không tìm thấy câu hỏi');
    }
    const questionAccessible =
      user.role === Role.ADMIN ||
      question.tenantId === user.tenantId ||
      (question.isGlobal && question.status === ContentStatus.APPROVED);
    if (!questionAccessible) {
      throw new ForbiddenException('Bạn không có quyền sử dụng câu hỏi này');
    }

    return this.prisma.examQuestion.create({
      data: {
        examId,
        questionId: dto.questionId,
        order: dto.order,
        maxScore: dto.maxScore,
      },
    });
  }

  async listQuestions(examId: string, user: JwtPayload) {
    const exam = await this.findOne(examId, user);
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
    const exam = await this.findExamOrThrow(examId);
    await this.assertStudentCanAccess(exam, user.sub);

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
    if (user.role === Role.TEACHER && attempt.exam.tenantId !== user.tenantId) {
      throw new ForbiddenException('Bạn không có quyền xem lượt làm bài này');
    }
    return attempt;
  }

  // Giáo viên/admin xem toàn bộ lượt làm bài của một đề để theo dõi tiến độ học sinh.
  async listAttemptsForExam(examId: string, user: JwtPayload) {
    const exam = await this.findExamOrThrow(examId);
    this.assertManageable(exam, user);
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
    if (user.role === Role.TEACHER && attempt.exam.tenantId !== user.tenantId) {
      throw new ForbiddenException('Bạn không có quyền xem lượt làm bài này');
    }
    if (attempt.status === AttemptStatus.IN_PROGRESS) {
      throw new BadRequestException(
        'Bài làm chưa được nộp, chưa thể xem đáp án',
      );
    }

    const answersByQuestionId = new Map(
      attempt.answers.map((a) => [a.questionId, a]),
    );
    return attempt.exam.examQuestions.map((eq) => {
      const answer = answersByQuestionId.get(eq.questionId);
      // Bài Văn thuộc lớp giáo viên: điểm/nhận xét AI sơ bộ chỉ là dữ liệu nội bộ
      // chờ giáo viên duyệt (xem GradingService.reviewEssay) — học sinh không được
      // thấy trước khi có điểm chính thức, kể cả khi status đã chuyển SUBMITTED.
      const pendingTeacherReview =
        eq.question.type === QuestionType.ESSAY &&
        answer != null &&
        !answer.isAiReferenceOnly &&
        answer.scoreAwarded === null;
      const hideAiFeedback = user.role === Role.STUDENT && pendingTeacherReview;
      return {
        questionId: eq.questionId,
        content: eq.question.content,
        type: eq.question.type,
        options: eq.question.options,
        correctAnswer: eq.question.correctAnswer,
        explanation: eq.question.explanation,
        maxScore: eq.maxScore,
        response: answer?.response ?? null,
        isCorrect: answer?.isCorrect ?? null,
        scoreAwarded: answer?.scoreAwarded ?? null,
        aiPreliminaryScore: hideAiFeedback
          ? null
          : (answer?.aiPreliminaryScore ?? null),
        aiComment: hideAiFeedback ? null : (answer?.aiComment ?? null),
        isAiReferenceOnly: answer?.isAiReferenceOnly ?? false,
      };
    });
  }
}
