// Bộ sinh câu hỏi tự động. Khi đã cấu hình GEMINI_API_KEY, QuestionsService
// gọi Gemini thật (xem synthesizeQuestionPrompt bên dưới) để soạn nội dung
// mới; hàm synthesizeQuestion() ở đây là fallback rule-based/templated khi
// chưa cấu hình hoặc Gemini gặp sự cố — không lấy nguyên văn bất kỳ đề
// thi/câu hỏi thật nào, chỉ dùng làm khung dữ liệu.
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

export const DIFFICULTY_LABEL: Record<DifficultyLevel, string> = {
  [DifficultyLevel.KNOWLEDGE]: 'nhận biết',
  [DifficultyLevel.COMPREHENSION]: 'thông hiểu',
  [DifficultyLevel.APPLICATION]: 'vận dụng',
  [DifficultyLevel.HIGH_APPLICATION]: 'vận dụng cao',
};

const TYPE_LABEL: Record<QuestionType, string> = {
  [QuestionType.MULTIPLE_CHOICE]:
    'trắc nghiệm nhiều lựa chọn (4 phương án, 1 đáp án đúng)',
  [QuestionType.TRUE_FALSE]:
    'đúng/sai (4 ý nhỏ a, b, c, d — mỗi ý đúng hoặc sai độc lập)',
  [QuestionType.SHORT_ANSWER]:
    'trắc nghiệm trả lời ngắn (điền một giá trị/số/từ ngắn)',
  [QuestionType.ESSAY]: 'tự luận Ngữ văn (Đọc hiểu + Viết)',
};

const SCHEMA_HINT: Record<QuestionType, string> = {
  [QuestionType.MULTIPLE_CHOICE]:
    '{"content": string, "options": [string, string, string, string], "correctAnswer": {"index": 0|1|2|3}, "explanation": string}',
  [QuestionType.TRUE_FALSE]:
    '{"content": string, "options": [string, string, string, string] (nội dung 4 ý a-d), "correctAnswer": {"statements": [boolean, boolean, boolean, boolean]}, "explanation": string}',
  [QuestionType.SHORT_ANSWER]:
    '{"content": string, "options": null, "correctAnswer": {"value": string}, "explanation": string}',
  [QuestionType.ESSAY]:
    '{"content": string (đề bài Đọc hiểu + Viết đầy đủ), "options": null, "correctAnswer": null, "explanation": ""}',
};

// Prompt gửi cho Gemini — dùng chung bởi QuestionsService khi đã cấu hình AI thật.
export function buildSynthesizePrompt(params: {
  type: QuestionType;
  difficulty: DifficultyLevel;
  subjectName: string;
  topicName: string;
}): string {
  const { type, difficulty, subjectName, topicName } = params;
  return `Bạn là chuyên gia biên soạn đề thi THPT quốc gia môn "${subjectName}" tại Việt Nam, theo cấu trúc đề thi từ 2025.

Hãy TỰ SOẠN một câu hỏi HOÀN TOÀN MỚI — KHÔNG sao chép nguyên văn bất kỳ đề thi chính thức của Bộ GD&ĐT, sách giáo khoa, hay tài liệu có bản quyền của bên thứ ba nào. Nội dung phải do bạn tự biên soạn.

Yêu cầu:
- Chuyên đề: "${topicName}"
- Mức độ: ${DIFFICULTY_LABEL[difficulty]}
- Dạng câu: ${TYPE_LABEL[type]}

Trả về DUY NHẤT một JSON đúng schema sau, không kèm bất kỳ văn bản giải thích nào khác ngoài JSON:
${SCHEMA_HINT[type]}`;
}

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
