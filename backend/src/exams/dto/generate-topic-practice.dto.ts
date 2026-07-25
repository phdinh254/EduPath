import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class GenerateTopicPracticeDto {
  @IsString()
  topicId: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(20)
  questionCount?: number;
}
