import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  Min,
  ValidateNested,
} from 'class-validator';
import { DifficultyLevel, QuestionType } from '@prisma/client';

export class ExamStructureItemDto {
  @IsEnum(QuestionType)
  type: QuestionType;

  @IsEnum(DifficultyLevel)
  difficulty: DifficultyLevel;

  @IsInt()
  @Min(1)
  questionCount: number;

  @IsNumber()
  @Min(0)
  maxScorePerQuestion: number;
}

export class UpsertExamStructureDto {
  @IsInt()
  @Min(1)
  durationMinutes: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ExamStructureItemDto)
  items: ExamStructureItemDto[];
}
