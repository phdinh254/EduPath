// Bộ sinh câu hỏi tự động — MVP rule-based/templated để hệ thống có thể vận
// hành luồng "AI soạn đề" ngay mà không cần giáo viên, thay thế bằng lời gọi
// LLM API thật (có kiểm soát chống sao chép nguyên văn đề thi/bản quyền) khi
// tích hợp. Không lấy nguyên văn bất kỳ đề thi/câu hỏi thật nào — nội dung ở
// đây là văn bản tự sinh theo khuôn mẫu, chỉ dùng làm khung dữ liệu.
import { DifficultyLevel, QuestionType } from '@prisma/client';

export interface SynthesizedQuestion {
  content: string;
  options: unknown;
  correctAnswer: unknown;
  explanation: string;
}

export interface SynthesizeParams {
  type: QuestionType;
  difficulty: DifficultyLevel;
  topicName: string;
  index: number;
}

const DIFFICULTY_LABEL: Record<DifficultyLevel, string> = {
  [DifficultyLevel.KNOWLEDGE]: 'nhận biết',
  [DifficultyLevel.COMPREHENSION]: 'thông hiểu',
  [DifficultyLevel.APPLICATION]: 'vận dụng',
  [DifficultyLevel.HIGH_APPLICATION]: 'vận dụng cao',
};

// Dùng index làm seed để kết quả tái lập được (không phụ thuộc Math.random),
// tránh sinh hai lần ra hai câu khác nhau cho cùng một yêu cầu.
function pick(seed: number, mod: number): number {
  return Math.floor((Math.abs(Math.sin(seed * 999.77)) % 1) * mod);
}

export function synthesizeQuestion(
  params: SynthesizeParams,
): SynthesizedQuestion {
  const { type, difficulty, topicName, index } = params;
  const label = DIFFICULTY_LABEL[difficulty];
  const base = `[AI sinh] Câu hỏi ${label} #${index + 1} thuộc chuyên đề "${topicName}"`;

  if (type === QuestionType.MULTIPLE_CHOICE) {
    const correctIndex = pick(index, 4);
    return {
      content: `${base}.`,
      options: ['Phương án A', 'Phương án B', 'Phương án C', 'Phương án D'],
      correctAnswer: { index: correctIndex },
      explanation: `Đáp án đúng là phương án ${['A', 'B', 'C', 'D'][correctIndex]} theo nội dung chuyên đề "${topicName}".`,
    };
  }

  if (type === QuestionType.TRUE_FALSE) {
    const statements = Array.from(
      { length: 4 },
      (_, i) => pick(index + i, 2) === 1,
    );
    return {
      content: `${base} — nhận định đúng/sai cho từng ý a, b, c, d.`,
      options: ['Ý a', 'Ý b', 'Ý c', 'Ý d'],
      correctAnswer: { statements },
      explanation: `Các ý đúng theo thứ tự a-d: ${statements.map((s) => (s ? 'Đúng' : 'Sai')).join(', ')}.`,
    };
  }

  if (type === QuestionType.SHORT_ANSWER) {
    return {
      content: `${base} — điền đáp án ngắn gọn.`,
      options: null,
      correctAnswer: { value: `dap-an-${index + 1}` },
      explanation: `Đáp án tham khảo: dap-an-${index + 1}.`,
    };
  }

  // ESSAY: chỉ có đề bài, không có đáp án đúng cố định — chấm qua AI khi nộp bài.
  return {
    content: `${base} — viết bài luận theo yêu cầu (Đọc hiểu + Viết).`,
    options: null,
    correctAnswer: null,
    explanation: '',
  };
}
