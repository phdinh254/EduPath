import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateClassDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
