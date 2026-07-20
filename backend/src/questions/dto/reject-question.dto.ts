import { IsOptional, IsString } from 'class-validator';

export class RejectQuestionDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
