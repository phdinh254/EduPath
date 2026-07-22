import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ExamCategory } from '@prisma/client';

export class CreateExamDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsEnum(ExamCategory)
  category?: ExamCategory;

  // Bắt buộc cho đề THPT (1 môn/đề). Đề ĐGNL không cần vì môn được xác định
  // theo từng section (xem GenerateExamDto) — tạo thủ công đề ĐGNL để trống.
  @IsOptional()
  @IsString()
  subjectId?: string;

  @IsInt()
  @Min(1)
  durationMinutes: number;

  // Nếu để trống: đề chính thức/dùng chung, mọi học sinh đều làm được.
  // Nếu có giá trị: chỉ học sinh thuộc lớp này mới làm được.
  @IsOptional()
  @IsString()
  classId?: string;
}
