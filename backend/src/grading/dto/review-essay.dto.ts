import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class ReviewEssayDto {
  @IsNumber()
  @Min(0)
  finalScore: number;

  @IsOptional()
  @IsString()
  comment?: string;
}
