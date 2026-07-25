import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { DifficultyLevel, QuestionType } from '@prisma/client';

// Mỗi câu hỏi đã được ADMIN rà soát/sửa lại từ bản nháp do AI tách ra —
// topicId bắt buộc (ADMIN phải gán đúng chuyên đề đã có, không dùng tên gợi
// ý thô của AI) vì đây là bước ghi thật vào kho dùng chung.
export class CommitImportedQuestionItemDto {
  @IsString()
  topicId: string;

  @IsEnum(QuestionType)
  type: QuestionType;

  @IsEnum(DifficultyLevel)
  difficulty: DifficultyLevel;

  @IsString()
  content: string;

  @IsOptional()
  options?: unknown;

  @IsOptional()
  correctAnswer?: unknown;

  @IsOptional()
  @IsString()
  explanation?: string;
}

export class CommitImportedQuestionsDto {
  @IsString()
  subjectId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CommitImportedQuestionItemDto)
  questions: CommitImportedQuestionItemDto[];
}
