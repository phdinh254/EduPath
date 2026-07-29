import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  AttemptStatus,
  ExamPublishStatus,
  ExamVisibility,
  Role,
} from '@prisma/client';
import { ExamsService } from './exams.service';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

function makeService(prismaOverrides: Record<string, unknown> = {}) {
  const prisma = {
    exam: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn() },
    examQuestion: { findUnique: jest.fn() },
    examAttempt: { findUnique: jest.fn() },
    answer: { upsert: jest.fn() },
    ...prismaOverrides,
  };
  const questionsService = {} as never;
  const gradingService = { submitAttempt: jest.fn() } as never;
  const service = new ExamsService(
    prisma as never,
    questionsService,
    gradingService,
  );
  return { service, prisma };
}

const studentUser: JwtPayload = {
  sub: 'student-1',
  role: Role.STUDENT,
  email: 's@test.dev',
};
const otherStudentUser: JwtPayload = {
  sub: 'student-2',
  role: Role.STUDENT,
  email: 's2@test.dev',
};
const adminUser: JwtPayload = {
  sub: 'admin-1',
  role: Role.ADMIN,
  email: 'a@test.dev',
};

describe('ExamsService — quyền sở hữu đề (visibility)', () => {
  it('STUDENT xem được đề PUBLIC + PUBLISHED của người khác', async () => {
    const { service, prisma } = makeService();
    const exam = {
      id: 'exam-1',
      createdById: 'someone-else',
      visibility: ExamVisibility.PUBLIC,
      status: ExamPublishStatus.PUBLISHED,
    };
    prisma.exam.findUnique.mockResolvedValue(exam);
    prisma.exam.findUniqueOrThrow.mockResolvedValue({ ...exam, sections: [] });

    await expect(service.findOne('exam-1', studentUser)).resolves.toEqual({
      ...exam,
      sections: [],
    });
  });

  it('STUDENT KHÔNG xem được đề PRIVATE của học sinh khác (404, không phải 403 — tránh lộ tồn tại)', async () => {
    const { service, prisma } = makeService();
    prisma.exam.findUnique.mockResolvedValue({
      id: 'exam-2',
      createdById: 'student-1',
      visibility: ExamVisibility.PRIVATE,
      status: ExamPublishStatus.PUBLISHED,
    });

    await expect(service.findOne('exam-2', otherStudentUser)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('STUDENT vẫn xem được đề PRIVATE của chính mình (đề luyện tập cá nhân)', async () => {
    const { service, prisma } = makeService();
    const exam = {
      id: 'exam-3',
      createdById: 'student-1',
      visibility: ExamVisibility.PRIVATE,
      status: ExamPublishStatus.PUBLISHED,
    };
    prisma.exam.findUnique.mockResolvedValue(exam);
    prisma.exam.findUniqueOrThrow.mockResolvedValue({ ...exam, sections: [] });

    await expect(service.findOne('exam-3', studentUser)).resolves.toEqual({
      ...exam,
      sections: [],
    });
  });

  it('STUDENT KHÔNG xem được đề PUBLIC nhưng còn DRAFT của ADMIN (chưa publish)', async () => {
    const { service, prisma } = makeService();
    prisma.exam.findUnique.mockResolvedValue({
      id: 'exam-4',
      createdById: 'admin-1',
      visibility: ExamVisibility.PUBLIC,
      status: ExamPublishStatus.DRAFT,
    });

    await expect(service.findOne('exam-4', studentUser)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('ADMIN xem được mọi đề PUBLIC bất kể trạng thái (kể cả DRAFT để tiếp tục soạn)', async () => {
    const { service, prisma } = makeService();
    const exam = {
      id: 'exam-5',
      createdById: 'someone-else',
      visibility: ExamVisibility.PUBLIC,
      status: ExamPublishStatus.DRAFT,
    };
    prisma.exam.findUnique.mockResolvedValue(exam);
    prisma.exam.findUniqueOrThrow.mockResolvedValue({ ...exam, sections: [] });

    await expect(service.findOne('exam-5', adminUser)).resolves.toEqual({
      ...exam,
      sections: [],
    });
  });
});

describe('ExamsService.saveAnswer — chặn câu hỏi ngoài đề', () => {
  const baseAttempt = {
    id: 'attempt-1',
    examId: 'exam-1',
    studentId: 'student-1',
    status: AttemptStatus.IN_PROGRESS,
    startedAt: new Date(),
  };

  it('từ chối lưu câu trả lời cho questionId không thuộc đề đang thi', async () => {
    const { service, prisma } = makeService();
    prisma.examAttempt.findUnique.mockResolvedValue(baseAttempt);
    prisma.exam.findUnique.mockResolvedValue({ durationMinutes: 60 });
    prisma.examQuestion.findUnique.mockResolvedValue(null); // không thuộc đề

    await expect(
      service.saveAnswer('attempt-1', studentUser, 'question-not-in-exam', {
        index: 0,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.answer.upsert).not.toHaveBeenCalled();
  });

  it('cho phép lưu câu trả lời khi questionId thuộc đề đang thi', async () => {
    const { service, prisma } = makeService();
    prisma.examAttempt.findUnique.mockResolvedValue(baseAttempt);
    prisma.exam.findUnique.mockResolvedValue({ durationMinutes: 60 });
    prisma.examQuestion.findUnique.mockResolvedValue({
      questionId: 'question-1',
    });
    prisma.answer.upsert.mockResolvedValue({ id: 'answer-1' });

    await service.saveAnswer('attempt-1', studentUser, 'question-1', {
      index: 1,
    });
    expect(prisma.answer.upsert).toHaveBeenCalledTimes(1);
  });

  it('từ chối nếu attempt không phải của học sinh đang gọi', async () => {
    const { service, prisma } = makeService();
    prisma.examAttempt.findUnique.mockResolvedValue(baseAttempt);

    await expect(
      service.saveAnswer('attempt-1', otherStudentUser, 'question-1', {
        index: 0,
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.examQuestion.findUnique).not.toHaveBeenCalled();
  });
});
