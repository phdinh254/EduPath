import { IsString } from 'class-validator';

export class UpdateClassDto {
  @IsString()
  name: string;
}
