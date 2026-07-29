import { IsString, MaxLength, MinLength } from 'class-validator';

export class ParseExamImportDto {
  @IsString()
  subjectId: string;

  // Văn bản thô của đề thi thật (đề thi thử/đề chính thức các năm trước) do
  // ADMIN dán vào — không giới hạn định dạng, AI sẽ tự tách câu hỏi. Giới hạn
  // độ dài để tránh nhồi văn bản khổng lồ vào một lệnh gọi Gemini (chi phí/khả
  // năng bị lợi dụng).
  @IsString()
  @MinLength(20)
  @MaxLength(20_000)
  rawText: string;
}
