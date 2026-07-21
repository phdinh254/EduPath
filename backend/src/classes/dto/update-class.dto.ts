import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateClassDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
