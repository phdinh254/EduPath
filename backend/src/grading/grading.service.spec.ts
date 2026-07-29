import { BadRequestException } from '@nestjs/common';
import { AttemptStatus, QuestionType, Role } from '@prisma/client';
import { GradingService } from './grading.service';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

// expect.objectContaining lồng nhau khiến @typescript-eslint/no-unsafe-assignment
// báo lỗi (kiểu suy luận ra `any`) — đọc thẳng tham số `update`/`data` đã gọi
// thay vì dùng matcher lồng nhau.
function lastCallArg(
  mockFn: jest.Mock,
  key: 'update' | 'data',
): Record<string, unknown> {
  const lastCall = mockFn.mock.calls.at(-1) as [Record<string, unknown>];
  return lastCall[0][key] as Record<string, unknown>;
}

function makeService() {
  const prisma = {
    examAttempt: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    answer: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    score: { upsert: jest.fn() },
  };
  const roadmapService = {
    generateForAttempt: jest.fn().mockResolvedValue(undefined),
  };
  const readinessService = {
    snapshotReadiness: jest.fn().mockResolvedValue(undefined),
  };
  const gemini = {
    isConfigured: jest.fn(),
    generateJson: jest.fn(),
    generateText: jest.fn(),
    getModelName: jest.fn().mockReturnValue('gemini-flash-latest'),
  };
  const gradeEssayQueue = { add: jest.fn().mockResolvedValue(undefined) };
  const service = new GradingService(
    prisma as never,
    roadmapService as never,
    readinessService as never,
    gemini as never,
    gradeEssayQueue as never,
  );
  return {
    service,
    prisma,
    roadmapService,
    readinessService,
    gemini,
    gradeEssayQueue,
  };
}

const student: JwtPayload = {
  sub: 'student-1',
  role: Role.STUDENT,
  email: 's@test.dev',
};

describe('GradingService.submitAttempt — khoá nguyên tử khi submit đồng thời', () => {
  it('request thua cuộc (count=0) bị chặn ngay, không chấm/không tạo phân tích', async () => {
    const { service, prisma, roadmapService } = makeService();
    prisma.examAttempt.findUnique.mockResolvedValueOnce({
      id: 'attempt-1',
      studentId: 'student-1',
      status: AttemptStatus.IN_PROGRESS,
      exam: { examQuestions: [] },
      answers: [],
    });
    // Request khác đã giành quyền cập nhật trước — count=0.
    prisma.examAttempt.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(service.submitAttempt('attempt-1', student)).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.answer.upsert).not.toHaveBeenCalled();
    expect(prisma.score.upsert).not.toHaveBeenCalled();
    expect(roadmapService.generateForAttempt).not.toHaveBeenCalled();
  });

  it('request thắng cuộc (count=1) chấm điểm và finalize GRADED bình thường (không có câu tự luận)', async () => {
    const { service, prisma, roadmapService, readinessService } = makeService();
    prisma.examAttempt.findUnique
      .mockResolvedValueOnce({
        id: 'attempt-1',
        studentId: 'student-1',
        status: AttemptStatus.IN_PROGRESS,
        exam: {
          examQuestions: [
            {
              questionId: 'q1',
              maxScore: 1,
              question: {
                type: QuestionType.MULTIPLE_CHOICE,
                correctAnswer: { index: 0 },
                topicId: 't1',
                subjectId: 's1',
              },
            },
          ],
        },
        answers: [{ questionId: 'q1', response: { index: 0 } }],
      })
      // Gọi lại để lấy studentId phục vụ readiness snapshot.
      .mockResolvedValueOnce({ studentId: 'student-1' })
      // Trả về kết quả cuối cùng.
      .mockResolvedValueOnce({
        id: 'attempt-1',
        status: AttemptStatus.GRADED,
        totalScore: 1,
      });
    prisma.examAttempt.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.answer.upsert.mockResolvedValue({});
    prisma.answer.findMany.mockResolvedValueOnce([
      {
        questionId: 'q1',
        isCorrect: true,
        scoreAwarded: 1,
        timeSpentSeconds: 5,
        gradedAt: new Date(),
        question: {
          type: QuestionType.MULTIPLE_CHOICE,
          topicId: 't1',
          subjectId: 's1',
        },
      },
    ]);
    prisma.score.upsert.mockResolvedValue({});
    prisma.examAttempt.update.mockResolvedValue({});

    await service.submitAttempt('attempt-1', student);

    expect(prisma.examAttempt.update).toHaveBeenCalledWith({
      where: { id: 'attempt-1' },
      data: { totalScore: 1, status: AttemptStatus.GRADED },
    });
    expect(roadmapService.generateForAttempt).toHaveBeenCalledWith('attempt-1');
    expect(readinessService.snapshotReadiness).toHaveBeenCalledWith(
      'student-1',
      's1',
    );
  });
});

describe('GradingService.submitAttempt — chấm tự luận', () => {
  const essayExam = {
    examQuestions: [
      {
        questionId: 'q-essay',
        maxScore: 10,
        question: {
          type: QuestionType.ESSAY,
          content: 'Đề bài Đọc hiểu + Viết',
        },
      },
    ],
  };
  const essayAnswers = [
    {
      questionId: 'q-essay',
      response: { text: 'Bài làm học sinh có nội dung.' },
    },
  ];

  it('Gemini chưa cấu hình — KHÔNG tự chấm theo số từ, chuyển PENDING_REVIEW ngay (không xếp hàng)', async () => {
    const { service, prisma, gemini, roadmapService, gradeEssayQueue } =
      makeService();
    gemini.isConfigured.mockReturnValue(false);
    prisma.examAttempt.findUnique.mockResolvedValueOnce({
      id: 'attempt-2',
      studentId: 'student-1',
      status: AttemptStatus.IN_PROGRESS,
      exam: essayExam,
      answers: essayAnswers,
    });
    prisma.examAttempt.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.answer.upsert.mockResolvedValue({});
    prisma.answer.findMany.mockResolvedValueOnce([
      {
        questionId: 'q-essay',
        needsManualGrading: true,
        scoreAwarded: null,
        gradedAt: null,
        question: { type: QuestionType.ESSAY },
      },
    ]);
    prisma.examAttempt.update.mockResolvedValue({
      status: AttemptStatus.PENDING_REVIEW,
    });

    await service.submitAttempt('attempt-2', student);

    expect(lastCallArg(prisma.answer.upsert, 'update')).toMatchObject({
      needsManualGrading: true,
      fallbackReason: 'GEMINI_NOT_CONFIGURED',
      scoreAwarded: null,
    });
    expect(gradeEssayQueue.add).not.toHaveBeenCalled();
    expect(prisma.examAttempt.update).toHaveBeenCalledWith({
      where: { id: 'attempt-2' },
      data: { status: AttemptStatus.PENDING_REVIEW },
      include: { answers: true, score: true },
    });
    expect(prisma.score.upsert).not.toHaveBeenCalled();
    expect(roadmapService.generateForAttempt).not.toHaveBeenCalled();
  });

  it('Gemini đã cấu hình + có nội dung — xếp hàng chấm nền, chưa gọi Gemini ngay, attempt chờ PENDING_REVIEW', async () => {
    const { service, prisma, gemini, gradeEssayQueue, roadmapService } =
      makeService();
    gemini.isConfigured.mockReturnValue(true);
    prisma.examAttempt.findUnique.mockResolvedValueOnce({
      id: 'attempt-3',
      studentId: 'student-1',
      status: AttemptStatus.IN_PROGRESS,
      exam: essayExam,
      answers: essayAnswers,
    });
    prisma.examAttempt.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.answer.upsert.mockResolvedValue({});
    prisma.answer.findMany.mockResolvedValueOnce([
      {
        questionId: 'q-essay',
        needsManualGrading: false,
        scoreAwarded: null,
        gradedAt: null,
        question: { type: QuestionType.ESSAY },
      },
    ]);
    prisma.examAttempt.update.mockResolvedValue({
      status: AttemptStatus.PENDING_REVIEW,
    });

    await service.submitAttempt('attempt-3', student);

    expect(gemini.generateJson).not.toHaveBeenCalled();
    expect(gradeEssayQueue.add).toHaveBeenCalledWith('grade-essay', {
      attemptId: 'attempt-3',
      questionId: 'q-essay',
      questionContent: 'Đề bài Đọc hiểu + Viết',
      maxScore: 10,
    });
    expect(lastCallArg(prisma.answer.upsert, 'update')).toMatchObject({
      scoreAwarded: null,
      needsManualGrading: false,
      gradedAt: null,
    });
    expect(prisma.examAttempt.update).toHaveBeenCalledWith({
      where: { id: 'attempt-3' },
      data: { status: AttemptStatus.PENDING_REVIEW },
      include: { answers: true, score: true },
    });
    expect(roadmapService.generateForAttempt).not.toHaveBeenCalled();
  });

  it('bài tự luận trắng (không nộp gì) vẫn được 0 điểm ngay, không xếp hàng, không cần ADMIN xác nhận', async () => {
    const { service, prisma, gemini, gradeEssayQueue } = makeService();
    gemini.isConfigured.mockReturnValue(true);
    prisma.examAttempt.findUnique.mockResolvedValueOnce({
      id: 'attempt-4',
      studentId: 'student-1',
      status: AttemptStatus.IN_PROGRESS,
      exam: essayExam,
      answers: [{ questionId: 'q-essay', response: null }],
    });
    prisma.examAttempt.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.answer.upsert.mockResolvedValue({});
    prisma.answer.findMany.mockResolvedValueOnce([
      {
        questionId: 'q-essay',
        needsManualGrading: false,
        scoreAwarded: 0,
        timeSpentSeconds: 0,
        gradedAt: new Date(),
        question: { type: QuestionType.ESSAY, topicId: null, subjectId: null },
      },
    ]);
    prisma.score.upsert.mockResolvedValue({});
    prisma.examAttempt.update.mockResolvedValue({});

    await service.submitAttempt('attempt-4', student);

    expect(gradeEssayQueue.add).not.toHaveBeenCalled();
    expect(lastCallArg(prisma.answer.upsert, 'update')).toMatchObject({
      needsManualGrading: false,
      scoreAwarded: 0,
    });
  });
});

describe('GradingService.processQueuedEssayGrading / markEssayGradingFailed', () => {
  const jobData = {
    attemptId: 'attempt-5',
    questionId: 'q-essay',
    questionContent: 'Đề bài',
    maxScore: 10,
  };

  it('chấm thành công qua job: cập nhật điểm AI và chạy lại recomputeScore', async () => {
    const { service, prisma, gemini, roadmapService } = makeService();
    prisma.answer.findUnique.mockResolvedValueOnce({
      response: { text: 'Bài làm học sinh.' },
    });
    gemini.generateJson.mockResolvedValueOnce({ score: 8, comment: 'Khá tốt' });
    prisma.answer.update.mockResolvedValue({});
    prisma.answer.findMany.mockResolvedValueOnce([
      {
        questionId: 'q-essay',
        scoreAwarded: 8,
        timeSpentSeconds: 0,
        gradedAt: new Date(),
        question: { type: QuestionType.ESSAY, topicId: null, subjectId: null },
      },
    ]);
    prisma.score.upsert.mockResolvedValue({});
    prisma.examAttempt.update.mockResolvedValue({});

    await service.processQueuedEssayGrading(jobData);

    expect(lastCallArg(prisma.answer.update, 'data')).toMatchObject({
      scoreAwarded: 8,
      aiComment: 'Khá tốt',
      needsManualGrading: false,
      gradingModel: 'gemini-flash-latest',
    });
    expect(prisma.examAttempt.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'attempt-5' } }),
    );
    expect(lastCallArg(prisma.examAttempt.update, 'data')).toMatchObject({
      status: AttemptStatus.GRADED,
    });
    expect(roadmapService.generateForAttempt).toHaveBeenCalledWith('attempt-5');
  });

  it('markEssayGradingFailed đánh dấu cần ADMIN chấm tay và chạy lại recomputeScore', async () => {
    const { service, prisma } = makeService();
    prisma.answer.update.mockResolvedValue({});
    prisma.answer.findMany.mockResolvedValueOnce([
      {
        questionId: 'q-essay',
        needsManualGrading: true,
        gradedAt: null,
        question: { type: QuestionType.ESSAY },
      },
    ]);
    prisma.examAttempt.update.mockResolvedValue({
      status: AttemptStatus.PENDING_REVIEW,
    });

    await service.markEssayGradingFailed('attempt-5', 'q-essay');

    expect(lastCallArg(prisma.answer.update, 'data')).toMatchObject({
      needsManualGrading: true,
      fallbackReason: 'GEMINI_ERROR',
      scoreAwarded: null,
    });
    expect(prisma.examAttempt.update).toHaveBeenCalledWith({
      where: { id: 'attempt-5' },
      data: { status: AttemptStatus.PENDING_REVIEW },
      include: { answers: true, score: true },
    });
  });
});
