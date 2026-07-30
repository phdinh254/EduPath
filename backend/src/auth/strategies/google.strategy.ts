import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import {
  Strategy,
  type Profile,
  type VerifyCallback,
} from 'passport-google-oauth20';
import { StatelessOAuthStateStore } from '../oauth-state.store';

export interface GoogleProfile {
  email: string;
  fullName: string;
}

// clientID/clientSecret dùng giá trị giả khi chưa cấu hình để app vẫn khởi
// động được — GoogleConfiguredGuard chặn request thật trước khi tới đây.
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    // state: true + store tuỳ biến (stateless) chống CSRF cho luồng OAuth —
    // không dùng NonceStore mặc định của passport-oauth2 vì nó cần
    // express-session, trong khi app này thuần JWT không có session.
    const stateSecret =
      config.get<string>('GOOGLE_CLIENT_SECRET') ||
      config.getOrThrow<string>('JWT_ACCESS_SECRET');
    super({
      clientID: config.get<string>('GOOGLE_CLIENT_ID') || 'unconfigured',
      clientSecret:
        config.get<string>('GOOGLE_CLIENT_SECRET') || 'unconfigured',
      callbackURL:
        config.get<string>('GOOGLE_CALLBACK_URL') ||
        'http://localhost:3000/auth/google/callback',
      scope: ['email', 'profile'],
      state: true,
      store: new StatelessOAuthStateStore(stateSecret),
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ) {
    // Chuẩn hoá giống RegisterDto/LoginDto — email từ Google profile không đi
    // qua ValidationPipe/DTO nên phải tự trim+lowercase ở đây để khớp với tài
    // khoản đã đăng ký bằng mật khẩu dùng cùng email nhưng khác hoa/thường.
    const rawEmail = profile.emails?.[0]?.value;
    const email = rawEmail?.trim().toLowerCase();
    if (!email) {
      done(new Error('Tài khoản Google không có email công khai'), false);
      return;
    }
    const user: GoogleProfile = {
      email,
      fullName: profile.displayName || email,
    };
    done(null, user);
  }
}
