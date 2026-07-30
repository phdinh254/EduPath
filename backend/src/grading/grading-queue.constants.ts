export const GRADE_ESSAY_QUEUE = 'grade-essay';

// jobId cố định (không random) — cho phép phát lại cùng một sự kiện outbox
// nhiều lần (từ OutboxSweepProcessor) mà không tạo job trùng, vì BullMQ tự
// bỏ qua add() thứ hai với cùng jobId khi job gốc còn tồn tại trong queue.
export function essayJobId(attemptId: string, questionId: string): string {
  return `grade-essay:${attemptId}:${questionId}`;
}

export interface GradeEssayJobData {
  attemptId: string;
  questionId: string;
  questionContent: string;
  maxScore: number;
}
