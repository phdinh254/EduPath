import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AttemptStatus, QuestionType, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RoadmapService } from '../roadmap/roadmap.service';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import {
  gradeEssayPlaceholder,
  gradeMultipleChoice,
  gradeShortAnswer,
  gradeTrueFalse,
} from './grading.utils';

@Injectable()
export class GradingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roadmapService: RoadmapService,
  ) {}

  async submitAttempt(attemptId: string, user: JwtPayload) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: { include: { examQuestions: { include: { question: true } } } },
        answers: true,
      },
    });
    if (!attempt) {
      throw new NotFoundException('Không tìm thấy lượt làm bài');
    }
    if (attempt.studentId !== user.sub) {
      throw new ForbiddenException('Đây không phải lượt làm bài của bạn');
    }
    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      throw new BadRequestException('Lượt làm bài đã được nộp trước đó');
    }

    // Chấm tự luận Ngữ văn chỉ là "điểm tham khảo do AI đánh giá" khi học sinh tự học
    // (đề không gắn với lớp học nào); nếu thuộc lớp giáo viên, chờ giáo viên duyệt.
    const isSelfStudyExam = attempt.exam.classId === null;

    const answersByQuestionId = new Map(
      attempt.answers.map((a) => [a.questionId, a]),
    );

    for (const eq of attempt.exam.examQuestions) {
      const existingAnswer = answersByQuestionId.get(eq.questionId);
      const response = existingAnswer?.response ?? null;

      if (eq.question.type === QuestionType.ESSAY) {
        const { score, comment } = gradeEssayPlaceholder(response, eq.maxScore);
        await this.prisma.answer.upsert({
          where: {
            attemptId_questionId: { attemptId, questionId: eq.questionId },
          },
          create: {
            attemptId,
            questionId: eq.questionId,
            response: response ?? undefined,
            aiPreliminaryScore: score,
            aiComment: comment,
            isAiReferenceOnly: isSelfStudyExam,
            scoreAwarded: isSelfStudyExam ? score : null,
          },
          update: {
            aiPreliminaryScore: score,
            aiComment: comment,
            isAiReferenceOnly: isSelfStudyExam,
            scoreAwarded: isSelfStudyExam ? score : null,
          },
        });
        continue;
      }

      const grader =
        eq.question.type === QuestionType.MULTIPLE_CHOICE
          ? gradeMultipleChoice
          : eq.question.type === QuestionType.TRUE_FALSE
            ? gradeTrueFalse
            : gradeShortAnswer;
      const { isCorrect, scoreAwarded } = grader(
        response,
        eq.question.correctAnswer,
        eq.maxScore,
      );

      await this.prisma.answer.upsert({
        where: {
          attemptId_questionId: { attemptId, questionId: eq.questionId },
        },
        create: {
          attemptId,
          questionId: eq.questionId,
          response: response ?? undefined,
          isCorrect,
          scoreAwarded,
        },
        update: { isCorrect, scoreAwarded },
      });
    }

    await this.prisma.examAttempt.update({
      where: { id: attemptId },
      data: { status: AttemptStatus.SUBMITTED, submittedAt: new Date() },
    });

    return this.recomputeScore(attemptId);
  }

  // Danh sách bài tự luận đã nộp, chờ giáo viên duyệt điểm AI chấm sơ bộ.
  findPendingReview(user: JwtPayload) {
    return this.prisma.answer.findMany({
      where: {
        question: { type: QuestionType.ESSAY },
        isAiReferenceOnly: false,
        scoreAwarded: null,
        attempt: {
          status: AttemptStatus.SUBMITTED,
          exam:
            user.role === Role.ADMIN ? undefined : { tenantId: user.tenantId },
        },
      },
      include: {
        question: { select: { id: true, content: true } },
        attempt: {
          include: {
            student: { select: { id: true, fullName: true, email: true } },
            exam: { select: { id: true, title: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async reviewEssay(
    answerId: string,
    user: JwtPayload,
    finalScore: number,
    comment?: string,
  ) {
    const answer = await this.prisma.answer.findUnique({
      where: { id: answerId },
      include: { question: true, attempt: { include: { exam: true } } },
    });
    if (!answer) {
      throw new NotFoundException('Không tìm thấy câu trả lời');
    }
    if (answer.question.type !== QuestionType.ESSAY) {
      throw new BadRequestException('Chỉ áp dụng duyệt điểm cho câu tự luận');
    }
    if (
      user.role !== Role.ADMIN &&
      answer.attempt.exam.tenantId !== user.tenantId
    ) {
      throw new ForbiddenException('Bạn không có quyền duyệt bài này');
    }

    const examQuestion = await this.prisma.examQuestion.findUnique({
      where: {
        examId_questionId: {
          examId: answer.attempt.examId,
          questionId: answer.questionId,
        },
      },
    });
    if (
      examQuestion &&
      (finalScore < 0 || finalScore > examQuestion.maxScore)
    ) {
      throw new BadRequestException(
        `Điểm phải trong khoảng 0 đến ${examQuestion.maxScore}`,
      );
    }

    await this.prisma.teacherReview.upsert({
      where: { answerId },
      create: {
        answerId,
        teacherId: user.sub,
        originalAiScore: answer.aiPreliminaryScore,
        finalScore,
        comment,
      },
      update: { finalScore, comment, teacherId: user.sub },
    });
    await this.prisma.answer.update({
      where: { id: answerId },
      data: { scoreAwarded: finalScore },
    });

    return this.recomputeScore(answer.attemptId);
  }

  private async recomputeScore(attemptId: string) {
    const answers = await this.prisma.answer.findMany({
      where: { attemptId },
      include: { question: true },
    });

    const totalScore = answers.reduce(
      (sum, a) => sum + (a.scoreAwarded ?? 0),
      0,
    );

    const topicBreakdown: Record<string, { correct: number; total: number }> =
      {};
    for (const a of answers) {
      if (a.question.type === QuestionType.ESSAY) continue; // không tính vào tỷ lệ đúng/sai nhị phân
      const entry = topicBreakdown[a.question.topicId] ?? {
        correct: 0,
        total: 0,
      };
      entry.total += 1;
      if (a.isCorrect) entry.correct += 1;
      topicBreakdown[a.question.topicId] = entry;
    }

    await this.prisma.score.upsert({
      where: { attemptId },
      create: { attemptId, totalScore, topicBreakdown },
      update: { totalScore, topicBreakdown },
    });

    const stillPendingReview = answers.some(
      (a) =>
        a.question.type === QuestionType.ESSAY &&
        !a.isAiReferenceOnly &&
        a.scoreAwarded === null,
    );
    const finalStatus = stillPendingReview
      ? AttemptStatus.SUBMITTED
      : AttemptStatus.GRADED;
    await this.prisma.examAttempt.update({
      where: { id: attemptId },
      data: { totalScore, status: finalStatus },
    });

    // Chỉ phân tích điểm yếu và cập nhật lộ trình khi bài đã được chấm xong hoàn toàn.
    if (finalStatus === AttemptStatus.GRADED) {
      await this.roadmapService.generateForAttempt(attemptId);
    }

    return this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: { answers: true, score: true },
    });
  }
}
