import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '@prisma/client';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  fullName: string;

  @IsEnum(Role)
  role: Role;

  // Bắt buộc khi role = TEACHER: tên lớp học/trung tâm, dùng để tạo Tenant riêng của giáo viên đó
  @IsOptional()
  @IsString()
  tenantName?: string;
}
