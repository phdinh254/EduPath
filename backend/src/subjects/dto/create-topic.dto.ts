import { IsOptional, IsString } from 'class-validator';

export class CreateTopicDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  parentTopicId?: string;
}
