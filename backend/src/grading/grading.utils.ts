// Quy tắc chấm điểm tự động cho 3 dạng câu hỏi trắc nghiệm theo cấu trúc đề thi
// tốt nghiệp THPT từ 2025. Cấu trúc JSON của response/correctAnswer do hệ thống
// tự định nghĩa (chưa có chuẩn ngoài để tuân theo):
//   MULTIPLE_CHOICE : { index: number }
//   TRUE_FALSE      : { statements: boolean[] }  // ý a, b, c, d...
//   SHORT_ANSWER    : { value: string }

// Thang điểm lũy tiến chính thức cho câu đúng/sai 4 ý (Bộ GD&ĐT, đề 2025):
// 1 ý đúng = 0.1, 2 ý đúng = 0.25, 3 ý đúng = 0.5, 4 ý đúng = 1.0 (phần trăm của điểm tối đa câu hỏi)
const TRUE_FALSE_4_SCALE: Record<number, number> = {
  0: 0,
  1: 0.1,
  2: 0.25,
  3: 0.5,
  4: 1,
};

export interface GradeResult {
  isCorrect: boolean | null;
  scoreAwarded: number;
}

export function gradeMultipleChoice(
  response: unknown,
  correctAnswer: unknown,
  maxScore: number,
): GradeResult {
  const chosen = (response as { index?: number } | null)?.index;
  const correct = (correctAnswer as { index?: number } | null)?.index;
  const isCorrect = chosen !== undefined && chosen === correct;
  return { isCorrect, scoreAwarded: isCorrect ? maxScore : 0 };
}

export function gradeTrueFalse(
  response: unknown,
  correctAnswer: unknown,
  maxScore: number,
): GradeResult {
  const given =
    (response as { statements?: boolean[] } | null)?.statements ?? [];
  const expected =
    (correctAnswer as { statements?: boolean[] } | null)?.statements ?? [];
  const total = expected.length;
  const correctCount = expected.reduce(
    (count, value, i) => (given[i] === value ? count + 1 : count),
    0,
  );

  const fraction =
    total === 4
      ? TRUE_FALSE_4_SCALE[correctCount]
      : total > 0
        ? correctCount / total
        : 0;
  return {
    isCorrect: total > 0 && correctCount === total,
    scoreAwarded: fraction * maxScore,
  };
}

export function gradeShortAnswer(
  response: unknown,
  correctAnswer: unknown,
  maxScore: number,
): GradeResult {
  const given = String((response as { value?: string } | null)?.value ?? '')
    .trim()
    .toLowerCase();
  const expected = String(
    (correctAnswer as { value?: string } | null)?.value ?? '',
  )
    .trim()
    .toLowerCase();
  const isCorrect = given.length > 0 && given === expected;
  return { isCorrect, scoreAwarded: isCorrect ? maxScore : 0 };
}

export type EssayFallbackReason = 'GEMINI_NOT_CONFIGURED' | 'GEMINI_ERROR';

export type EssayGradeOutcome =
  | { status: 'GRADED'; score: number; comment: string }
  | { status: 'PENDING_REVIEW'; reason: EssayFallbackReason; comment: string };

// Khi Gemini không khả dụng (chưa cấu hình hoặc gọi lỗi), TUYỆT ĐỐI không tự
// chấm điểm tự luận theo số từ/độ dài — số từ không phản ánh chất lượng nội
// dung học thuật thật. Chỉ ngoại lệ: bài trắng (không nộp gì) là 0 điểm hiển
// nhiên, không cần con người xác nhận. Mọi bài có nội dung phải chờ ADMIN
// chấm tay (Answer.needsManualGrading — xem GradingService.reviewEssay).
export function gradeEssayFallback(
  response: unknown,
  reason: EssayFallbackReason,
): EssayGradeOutcome {
  const text = String(
    (response as { text?: string } | null)?.text ?? '',
  ).trim();
  if (!text) {
    return {
      status: 'GRADED',
      score: 0,
      comment: 'Học sinh chưa nộp bài viết.',
    };
  }
  return {
    status: 'PENDING_REVIEW',
    reason,
    comment:
      'AI hiện chưa chấm được nội dung bài này — đang chờ ADMIN chấm tay, điểm sẽ được công bố sau.',
  };
}
