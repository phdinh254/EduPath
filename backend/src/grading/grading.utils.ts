// Quy tắc chấm điểm tự động cho 3 dạng câu hỏi trắc nghiệm theo cấu trúc đề thi
// tốt nghiệp THPT từ 2025. Cấu trúc JSON của response/correctAnswer do hệ thống
// tự định nghĩa (chưa có chuẩn ngoài để tuân theo):
//   MULTIPLE_CHOICE : { index: number }
//   TRUE_FALSE      : { statements: boolean[] }  // ý a, b, c, d...
//   SHORT_ANSWER    : { value: string }

// Thang điểm lũy tiến chính thức cho câu đúng/sai 4 ý (Bộ GD&ĐT, đề 2025):
// 1 ý đúng = 0.1, 2 ý đúng = 0.25, 3 ý đúng = 0.5, 4 ý đúng = 1.0 (phần trăm của điểm tối đa câu hỏi)
const TRUE_FALSE_4_SCALE: Record<number, number> = { 0: 0, 1: 0.1, 2: 0.25, 3: 0.5, 4: 1 };

export interface GradeResult {
  isCorrect: boolean | null;
  scoreAwarded: number;
}

export function gradeMultipleChoice(response: unknown, correctAnswer: unknown, maxScore: number): GradeResult {
  const chosen = (response as { index?: number } | null)?.index;
  const correct = (correctAnswer as { index?: number } | null)?.index;
  const isCorrect = chosen !== undefined && chosen === correct;
  return { isCorrect, scoreAwarded: isCorrect ? maxScore : 0 };
}

export function gradeTrueFalse(response: unknown, correctAnswer: unknown, maxScore: number): GradeResult {
  const given = (response as { statements?: boolean[] } | null)?.statements ?? [];
  const expected = (correctAnswer as { statements?: boolean[] } | null)?.statements ?? [];
  const total = expected.length;
  const correctCount = expected.reduce((count, value, i) => (given[i] === value ? count + 1 : count), 0);

  const fraction = total === 4 ? TRUE_FALSE_4_SCALE[correctCount] : total > 0 ? correctCount / total : 0;
  return { isCorrect: total > 0 && correctCount === total, scoreAwarded: fraction * maxScore };
}

export function gradeShortAnswer(response: unknown, correctAnswer: unknown, maxScore: number): GradeResult {
  const given = String((response as { value?: string } | null)?.value ?? '').trim().toLowerCase();
  const expected = String((correctAnswer as { value?: string } | null)?.value ?? '').trim().toLowerCase();
  const isCorrect = given.length > 0 && given === expected;
  return { isCorrect, scoreAwarded: isCorrect ? maxScore : 0 };
}

// Placeholder cho chấm tự luận bằng AI — thay bằng lời gọi LLM API thật khi tích hợp.
// AI chỉ được đưa nhận xét sơ bộ dựa trên nội dung học sinh nộp, không tự bịa nội dung ngoài phạm vi bài làm.
export function gradeEssayPlaceholder(response: unknown, maxScore: number): { score: number; comment: string } {
  const text = String((response as { text?: string } | null)?.text ?? '');
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const score = wordCount === 0 ? 0 : Math.min(maxScore, (wordCount / 200) * maxScore);
  const comment =
    wordCount === 0
      ? 'Học sinh chưa nộp bài viết.'
      : `Nhận xét sơ bộ do AI đánh giá dựa trên độ dài và cấu trúc bài viết (${wordCount} từ). Cần giáo viên xem lại nội dung chi tiết.`;
  return { score, comment };
}
