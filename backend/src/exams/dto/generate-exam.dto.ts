import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { ExamCategory } from '@prisma/client';

export class GenerateExamSectionDto {
  @IsString()
  name: string;

  @IsString()
  subjectId: string;

  @IsInt()
  @Min(1)
  questionCount: number;

  @IsNumber()
  @Min(0)
  maxScore: number;
}

export class GenerateExamDto {
  @IsString()
  title: string;

  @IsEnum(ExamCategory)
  category: ExamCategory;

  @IsInt()
  @Min(1)
  durationMinutes: number;

  @IsOptional()
  @IsString()
  classId?: string;

  // --- THPT: 1 môn/đề ---
  @IsOptional()
  @IsString()
  subjectId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  multipleChoiceCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  trueFalseCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  shortAnswerCount?: number;

  // Môn Ngữ văn: chỉ sinh câu tự luận (Đọc hiểu + Viết), không trộn với trắc nghiệm.
  @IsOptional()
  @IsInt()
  @Min(0)
  essayCount?: number;

  // --- ĐGNL: nhiều môn/section, tổng thang điểm 150 ---
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GenerateExamSectionDto)
  sections?: GenerateExamSectionDto[];
}
