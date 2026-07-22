import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class AddExamQuestionDto {
  @IsString()
  questionId: string;

  // Chỉ áp dụng với đề ĐGNL — ID của ExamSection câu hỏi này thuộc về.
  @IsOptional()
  @IsString()
  sectionId?: string;

  @IsInt()
  @Min(1)
  order: number;

  @IsNumber()
  @Min(0)
  maxScore: number;
}
