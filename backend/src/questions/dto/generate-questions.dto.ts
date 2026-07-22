import { IsEnum, IsInt, IsString, Max, Min } from 'class-validator';
import { DifficultyLevel, QuestionType } from '@prisma/client';

export class GenerateQuestionsDto {
  @IsString()
  subjectId: string;

  @IsString()
  topicId: string;

  @IsEnum(QuestionType)
  type: QuestionType;

  @IsEnum(DifficultyLevel)
  difficulty: DifficultyLevel;

  @IsInt()
  @Min(1)
  @Max(100)
  count: number;
}
