import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateExamDto {
  @IsString()
  title: string;

  @IsString()
  subjectId: string;

  @IsInt()
  @Min(1)
  durationMinutes: number;

  // Nếu để trống: đề chính thức/dùng chung, mọi học sinh đều làm được.
  // Nếu có giá trị: chỉ học sinh thuộc lớp này mới làm được.
  @IsOptional()
  @IsString()
  classId?: string;
}
