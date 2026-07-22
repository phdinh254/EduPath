import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import {
  Strategy,
  type Profile,
  type VerifyCallback,
} from 'passport-google-oauth20';

export interface GoogleProfile {
  email: string;
  fullName: string;
}

// clientID/clientSecret dùng giá trị giả khi chưa cấu hình để app vẫn khởi
// động được — GoogleConfiguredGuard chặn request thật trước khi tới đây.
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    super({
      clientID: config.get<string>('GOOGLE_CLIENT_ID') || 'unconfigured',
      clientSecret:
        config.get<string>('GOOGLE_CLIENT_SECRET') || 'unconfigured',
      callbackURL:
        config.get<string>('GOOGLE_CALLBACK_URL') ||
        'http://localhost:3000/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ) {
    const email = profile.emails?.[0]?.value;
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
