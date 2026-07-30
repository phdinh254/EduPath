import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
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
import { OAuthExchangeDto } from './dto/oauth-exchange.dto';
import { Public } from './decorators/public.decorator';
import { GoogleConfiguredGuard } from './guards/google-configured.guard';
import type { GoogleProfile } from './strategies/google.strategy';
import { OAuthExchangeService } from './oauth-exchange.service';

const REFRESH_COOKIE_NAME = 'refreshToken';
// Path phải khớp với path MÀ TRÌNH DUYỆT THẤY, không phải route thật trên
// backend: cả Vite dev proxy (vite.config.ts) lẫn Nginx production
// (frontend/nginx.conf) expose API dưới prefix "/api/" rồi mới rewrite bỏ
// "/api" khi forward sang backend. Nếu để "/auth" (route thật, không prefix),
// trình duyệt không bao giờ thấy request nào khớp path đó (chỉ gọi
// "/api/auth/..."), nên sẽ không bao giờ gửi lại cookie — /auth/refresh luôn
// 401 "Không tìm thấy refresh token" ngay sau khi đăng nhập.
const REFRESH_COOKIE_PATH = '/api/auth';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
    private readonly oauthExchange: OAuthExchangeService,
  ) {}

  // Refresh token không còn trả trong JSON body — luôn đặt vào cookie
  // HttpOnly để JS phía frontend (kể cả khi bị XSS) không đọc được trực tiếp.
  // Secure chỉ bật ở production vì dev chạy HTTP thuần (localhost).
  private setRefreshCookie(res: Response, token: string) {
    res.cookie(REFRESH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: this.config.get<string>('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: REFRESH_COOKIE_PATH,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  private clearRefreshCookie(res: Response) {
    res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  @ApiOperation({
    summary: 'Đăng ký tài khoản học sinh mới',
    description:
      'Công khai, không cần token. Luôn tạo tài khoản STUDENT — tài khoản ADMIN chỉ được tạo trực tiếp trong DB.',
  })
  @ApiResponse({
    status: 201,
    description:
      'Tạo tài khoản thành công. Trả về accessToken; refreshToken được đặt vào cookie HttpOnly.',
  })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ.' })
  @ApiResponse({ status: 409, description: 'Email đã được sử dụng.' })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.register(dto);
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Đăng nhập',
    description:
      'Công khai, không cần token. Khoá tạm thời 15 phút sau 5 lần sai liên tiếp.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Đăng nhập thành công. Trả về accessToken; refreshToken được đặt vào cookie HttpOnly.',
  })
  @ApiResponse({
    status: 401,
    description:
      'Email hoặc mật khẩu không đúng, hoặc tài khoản đang bị khoá tạm thời.',
  })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.login(dto);
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken };
  }

  @Public()
  @UseGuards(GoogleConfiguredGuard, AuthGuard('google'))
  @Get('google')
  @ApiOperation({
    summary: 'Bắt đầu đăng nhập/đăng ký bằng Google',
    description:
      'Công khai. Chuyển hướng sang màn hình đồng ý của Google (kèm state chống CSRF) — không gọi trực tiếp từ code, chỉ dùng làm href cho trình duyệt.',
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
    // KHÔNG đặt accessToken/refreshToken vào query string (bị log ở
    // proxy/trình duyệt/lịch sử) — chỉ redirect kèm một mã dùng một lần,
    // frontend đổi mã lấy token thật qua POST /auth/oauth/exchange.
    const code = this.oauthExchange.create(
      tokens.accessToken,
      tokens.refreshToken,
    );
    const frontendUrl =
      this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
    const redirectUrl = new URL('/auth/callback', frontendUrl);
    redirectUrl.searchParams.set('code', code);
    res.redirect(redirectUrl.toString());
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('oauth/exchange')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Đổi mã dùng một lần (từ Google callback) lấy phiên đăng nhập',
    description:
      'Công khai. Mã chỉ dùng được một lần và hết hạn sau 60 giây — xem AuthController.googleCallback.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Trả về accessToken; refreshToken được đặt vào cookie HttpOnly.',
  })
  @ApiResponse({ status: 401, description: 'Mã không hợp lệ hoặc đã hết hạn.' })
  exchangeOAuthCode(
    @Body() dto: OAuthExchangeDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = this.oauthExchange.redeem(dto.code);
    if (!tokens) {
      throw new UnauthorizedException(
        'Mã đăng nhập không hợp lệ hoặc đã hết hạn',
      );
    }
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken };
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Làm mới access token',
    description:
      'Công khai (dùng refresh token từ cookie HttpOnly thay vì access token). Refresh token được xoay vòng: token cũ bị thu hồi ngay khi dùng, chỉ dùng được một lần.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Trả về accessToken mới; refreshToken mới được đặt vào cookie.',
  })
  @ApiResponse({
    status: 401,
    description:
      'Refresh token không hợp lệ, đã hết hạn, đã bị thu hồi, hoặc tài khoản không còn hoạt động.',
  })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = (req.cookies as Record<string, string> | undefined)?.[
      REFRESH_COOKIE_NAME
    ];
    if (!refreshToken) {
      throw new UnauthorizedException('Không tìm thấy refresh token');
    }
    const tokens = await this.authService.refresh(refreshToken);
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Đăng xuất',
    description:
      'Công khai. Thu hồi refresh token trong cookie (best-effort) và xoá cookie.',
  })
  @ApiResponse({
    status: 200,
    description: 'Đã thu hồi refresh token (nếu tồn tại) và xoá cookie.',
  })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = (req.cookies as Record<string, string> | undefined)?.[
      REFRESH_COOKIE_NAME
    ];
    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }
    this.clearRefreshCookie(res);
    return { success: true };
  }
}
