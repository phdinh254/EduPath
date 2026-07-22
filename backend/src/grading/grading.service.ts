import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AttemptStatus, QuestionType } from '@prisma/client';
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

    const answersByQuestionId = new Map(
      attempt.answers.map((a) => [a.questionId, a]),
    );

    for (const eq of attempt.exam.examQuestions) {
      const existingAnswer = answersByQuestionId.get(eq.questionId);
      const response = existingAnswer?.response ?? null;

      if (eq.question.type === QuestionType.ESSAY) {
        // AI chấm và công bố điểm tự luận ngay lập tức — luôn gắn nhãn "điểm
        // tham khảo do AI đánh giá". ADMIN có thể điều chỉnh lại sau qua
        // reviewEssay() mà không chặn học sinh xem điểm ngay.
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
            isAiReferenceOnly: true,
            scoreAwarded: score,
          },
          update: {
            aiPreliminaryScore: score,
            aiComment: comment,
            isAiReferenceOnly: true,
            scoreAwarded: score,
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

  // Danh sách câu tự luận AI đã chấm và công bố điểm, nhưng ADMIN chưa hậu
  // kiểm lần nào (chưa có ScoreOverride) — dùng để spot-check chất lượng AI,
  // không chặn công bố điểm.
  findPendingReview() {
    return this.prisma.answer.findMany({
      where: {
        question: { type: QuestionType.ESSAY },
        scoreOverride: null,
        attempt: {
          status: { in: [AttemptStatus.SUBMITTED, AttemptStatus.GRADED] },
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

  // ADMIN điều chỉnh lại điểm AI đã công bố (hậu kiểm) — không chặn công bố
  // ban đầu, chỉ ghi đè điểm chính thức nếu cần sửa.
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

    await this.prisma.scoreOverride.upsert({
      where: { answerId },
      create: {
        answerId,
        reviewerId: user.sub,
        originalAiScore: answer.aiPreliminaryScore,
        finalScore,
        comment,
      },
      update: { finalScore, comment, reviewerId: user.sub },
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

    const topicBreakdown: Record<
      string,
      { correct: number; total: number; subjectId: string }
    > = {};
    for (const a of answers) {
      if (a.question.type === QuestionType.ESSAY) continue; // không tính vào tỷ lệ đúng/sai nhị phân
      const entry = topicBreakdown[a.question.topicId] ?? {
        correct: 0,
        total: 0,
        subjectId: a.question.subjectId,
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

    // AI chấm và công bố điểm ngay cho mọi dạng câu (kể cả tự luận Văn).
    await this.prisma.examAttempt.update({
      where: { id: attemptId },
      data: { totalScore, status: AttemptStatus.GRADED },
    });

    await this.roadmapService.generateForAttempt(attemptId);

    return this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: { answers: true, score: true },
    });
  }
}
