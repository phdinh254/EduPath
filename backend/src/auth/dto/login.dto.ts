import { Transform, type TransformFnParams } from 'class-transformer';
import { IsEmail, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @Transform(({ value }: TransformFnParams) =>
    typeof value === 'string' ? value.trim().toLowerCase() : (value as unknown),
  )
  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  @MaxLength(128)
  password: string;
}
