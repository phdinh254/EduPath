import { IsEmail, IsString, MinLength } from 'class-validator';

// Đăng ký công khai luôn tạo tài khoản STUDENT — không nhận role từ client.
// Tài khoản ADMIN chỉ được tạo trực tiếp trong DB (không có luồng tự đăng ký).
export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  fullName: string;
}
