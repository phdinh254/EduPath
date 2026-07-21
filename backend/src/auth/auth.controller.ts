import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { Public } from './decorators/public.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({
    summary: 'Đăng ký tài khoản mới',
    description:
      'Công khai, không cần token. role=TEACHER bắt buộc kèm tenantName để tự động tạo Tenant riêng cho giáo viên/trung tâm đó.',
  })
  @ApiResponse({
    status: 201,
    description: 'Tạo tài khoản thành công, trả về cặp access/refresh token.',
  })
  @ApiResponse({
    status: 400,
    description: 'Dữ liệu không hợp lệ (ví dụ TEACHER thiếu tenantName).',
  })
  @ApiResponse({ status: 409, description: 'Email đã được sử dụng.' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Đăng nhập',
    description: 'Công khai, không cần token.',
  })
  @ApiResponse({
    status: 200,
    description: 'Đăng nhập thành công, trả về cặp access/refresh token.',
  })
  @ApiResponse({ status: 401, description: 'Email hoặc mật khẩu không đúng.' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Làm mới access token',
    description:
      'Công khai (dùng refresh token thay vì access token). Refresh token được xoay vòng: token cũ bị thu hồi ngay khi dùng, chỉ dùng được một lần.',
  })
  @ApiResponse({
    status: 200,
    description: 'Trả về cặp access/refresh token mới.',
  })
  @ApiResponse({
    status: 401,
    description:
      'Refresh token không hợp lệ, đã hết hạn, đã bị thu hồi, hoặc tài khoản không còn hoạt động.',
  })
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Đăng xuất',
    description:
      'Công khai. Thu hồi refresh token được cung cấp (best-effort).',
  })
  @ApiResponse({
    status: 200,
    description: 'Đã thu hồi refresh token (nếu tồn tại).',
  })
  logout(@Body() dto: RefreshDto) {
    return this.authService.logout(dto.refreshToken);
  }
}
