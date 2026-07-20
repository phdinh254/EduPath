import { IsInt, IsNumber, IsString, Min } from 'class-validator';

export class AddExamQuestionDto {
  @IsString()
  questionId: string;

  @IsInt()
  @Min(1)
  order: number;

  @IsNumber()
  @Min(0)
  maxScore: number;
}
