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

  // Bỏ trống để dùng durationMinutes mặc định từ cấu trúc đề của môn (THPT).
  // Bắt buộc với ĐGNL vì không gắn với cấu trúc theo môn.
  @IsOptional()
  @IsInt()
  @Min(1)
  durationMinutes?: number;

  // --- THPT: 1 môn/đề, số câu theo dạng × mức độ khó lấy từ ExamStructure
  // đã cấu hình sẵn cho môn (xem SubjectsService.upsertExamStructure) ---
  @IsOptional()
  @IsString()
  subjectId?: string;

  // --- ĐGNL: nhiều môn/section, tổng thang điểm 150 — chọn 1 trong 2: dùng
  // mẫu đề có sẵn (dgnlTemplateId, xem DgnlTemplatesService) hoặc tự khai báo
  // sections thủ công như trước. ---
  @IsOptional()
  @IsString()
  dgnlTemplateId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GenerateExamSectionDto)
  sections?: GenerateExamSectionDto[];
}
