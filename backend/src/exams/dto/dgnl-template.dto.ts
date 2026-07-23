import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class DgnlTemplateSectionDto {
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

export class CreateDgnlTemplateDto {
  @IsString()
  name: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DgnlTemplateSectionDto)
  sections: DgnlTemplateSectionDto[];
}
