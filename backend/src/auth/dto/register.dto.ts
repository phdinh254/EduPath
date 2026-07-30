import { Transform, type TransformFnParams } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

// Đăng ký công khai luôn tạo tài khoản STUDENT — không nhận role từ client.
// Tài khoản ADMIN chỉ được tạo trực tiếp trong DB (không có luồng tự đăng ký).
export class RegisterDto {
  // Chuẩn hoá TRƯỚC khi validate/so khớp DB — "User@Test.dev" và
  // " user@test.dev " phải được coi là cùng một tài khoản, không tạo được
  // hai bản ghi khác nhau cho cùng một email.
  @Transform(({ value }: TransformFnParams) =>
    typeof value === 'string' ? value.trim().toLowerCase() : (value as unknown),
  )
  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @IsString()
  @MaxLength(200)
  fullName: string;
}
