// Tách văn bản thô của một đề thi THẬT (thi thử, đề chính thức các năm
// trước do ADMIN dán vào) thành danh sách câu hỏi có cấu trúc. Khác hẳn
// ai-question.generator.ts (soạn câu hỏi MỚI) — ở đây AI chỉ TRÍCH XUẤT lại
// đúng nội dung đã có trong văn bản đầu vào, không tự bịa thêm câu hỏi hay
// đáp án nào ngoài những gì ADMIN đã cung cấp.
import { DifficultyLevel, QuestionType } from '@prisma/client';

export interface ParsedImportQuestion {
  content: string;
  type: QuestionType;
  options: unknown;
  correctAnswer: unknown;
  explanation: string | null;
  suggestedTopicName: string;
  suggestedDifficulty: DifficultyLevel;
}

export function buildParseImportPrompt(params: {
  subjectName: string;
  topicNames: string[];
  rawText: string;
}): string {
  const { subjectName, topicNames, rawText } = params;
  return `Bạn là trợ lý số hoá đề thi cho môn "${subjectName}" tại Việt Nam. ADMIN vừa dán vào một đoạn văn bản thô của MỘT ĐỀ THI THẬT (đề thi thử hoặc đề thi chính thức các năm trước) — nhiệm vụ của bạn là TÁCH LẠI đúng nguyên các câu hỏi đã có trong văn bản, KHÔNG được tự bịa thêm câu hỏi mới, KHÔNG suy diễn đáp án nếu văn bản không có đáp án rõ ràng (khi đó để correctAnswer là null).

Danh sách chuyên đề đã có sẵn của môn này (cố gắng khớp câu hỏi vào một trong các tên sau, viết đúng nguyên văn tên chuyên đề nếu khớp; nếu không chuyên đề nào phù hợp thì đề xuất một tên chuyên đề ngắn gọn mới):
${topicNames.map((t) => `- ${t}`).join('\n')}

Văn bản đề thi (có thể chứa nhiều câu hỏi, đôi khi kèm đáp án ở cuối):
"""
${rawText}
"""

Với mỗi câu hỏi tìm thấy, xác định đúng dạng câu theo cấu trúc thi THPT 2025:
- MULTIPLE_CHOICE: trắc nghiệm nhiều lựa chọn, chọn 1 đáp án đúng trong 4 phương án.
- TRUE_FALSE: đúng/sai với đúng 4 ý nhỏ a, b, c, d.
- SHORT_ANSWER: điền một giá trị/số/từ ngắn.
- ESSAY: tự luận (chỉ áp dụng Ngữ văn).

Trả về DUY NHẤT một JSON array đúng schema sau, không kèm văn bản nào khác:
[{
  "content": string,
  "type": "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER" | "ESSAY",
  "options": [string, ...] hoặc null (null với SHORT_ANSWER/ESSAY),
  "correctAnswer": object hoặc null (null nếu văn bản không có đáp án rõ ràng) — với MULTIPLE_CHOICE dùng {"index": 0-3}, TRUE_FALSE dùng {"statements": [bool,bool,bool,bool]}, SHORT_ANSWER dùng {"value": string},
  "explanation": string hoặc null (chỉ điền nếu văn bản có sẵn lời giải, không tự bịa),
  "suggestedTopicName": string,
  "suggestedDifficulty": "KNOWLEDGE" | "COMPREHENSION" | "APPLICATION" | "HIGH_APPLICATION"
}]`;
}
