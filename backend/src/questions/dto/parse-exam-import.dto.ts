import { IsString, MinLength } from 'class-validator';

export class ParseExamImportDto {
  @IsString()
  subjectId: string;

  // Văn bản thô của đề thi thật (đề thi thử/đề chính thức các năm trước) do
  // ADMIN dán vào — không giới hạn định dạng, AI sẽ tự tách câu hỏi.
  @IsString()
  @MinLength(20)
  rawText: string;
}
