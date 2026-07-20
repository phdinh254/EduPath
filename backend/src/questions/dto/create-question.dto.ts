import { IsEnum, IsOptional, IsString } from 'class-validator';
import { DifficultyLevel, QuestionType } from '@prisma/client';

export class CreateQuestionDto {
  @IsString()
  subjectId: string;

  @IsString()
  topicId: string;

  @IsEnum(QuestionType)
  type: QuestionType;

  @IsEnum(DifficultyLevel)
  difficulty: DifficultyLevel;

  @IsString()
  content: string;

  // Lựa chọn cho multiple choice / true-false, null với short answer / essay
  @IsOptional()
  options?: unknown;

  // Đáp án đúng, cấu trúc tuỳ theo `type` (không bắt buộc với essay)
  @IsOptional()
  correctAnswer?: unknown;

  @IsOptional()
  @IsString()
  explanation?: string;
}
