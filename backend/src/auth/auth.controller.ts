import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiExcludeEndpoint,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { Public } from './decorators/public.decorator';
import { GoogleConfiguredGuard } from './guards/google-configured.guard';
import type { GoogleProfile } from './strategies/google.strategy';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('register')
  @ApiOperation({
    summary: 'Đăng ký tài khoản học sinh mới',
    description:
      'Công khai, không cần token. Luôn tạo tài khoản STUDENT — tài khoản ADMIN chỉ được tạo trực tiếp trong DB.',
  })
  @ApiResponse({
    status: 201,
    description: 'Tạo tài khoản thành công, trả về cặp access/refresh token.',
  })
  @ApiResponse({
    status: 400,
    description: 'Dữ liệu không hợp lệ.',
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
  @UseGuards(GoogleConfiguredGuard, AuthGuard('google'))
  @Get('google')
  @ApiOperation({
    summary: 'Bắt đầu đăng nhập/đăng ký bằng Google',
    description:
      'Công khai. Chuyển hướng sang màn hình đồng ý của Google — không gọi trực tiếp từ code, chỉ dùng làm href cho trình duyệt.',
  })
  @ApiResponse({ status: 302, description: 'Chuyển hướng sang Google.' })
  googleAuth() {
    // Passport tự động redirect sang Google trước khi vào tới đây.
  }

  @Public()
  @UseGuards(GoogleConfiguredGuard, AuthGuard('google'))
  @Get('google/callback')
  @ApiExcludeEndpoint()
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const profile = req.user as GoogleProfile;
    const tokens = await this.authService.loginWithGoogle(profile);
    const frontendUrl =
      this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
    const redirectUrl = new URL('/auth/callback', frontendUrl);
    redirectUrl.searchParams.set('accessToken', tokens.accessToken);
    redirectUrl.searchParams.set('refreshToken', tokens.refreshToken);
    res.redirect(redirectUrl.toString());
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
