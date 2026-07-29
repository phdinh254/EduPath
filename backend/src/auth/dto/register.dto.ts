import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

// Đăng ký công khai luôn tạo tài khoản STUDENT — không nhận role từ client.
// Tài khoản ADMIN chỉ được tạo trực tiếp trong DB (không có luồng tự đăng ký).
export class RegisterDto {
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
