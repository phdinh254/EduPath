import {
  CanActivate,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Chặn sớm với thông báo rõ ràng thay vì để passport-google-oauth20 ném lỗi
// khó hiểu khi GOOGLE_CLIENT_ID/SECRET chưa được cấu hình trên máy chủ.
@Injectable()
export class GoogleConfiguredGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(): boolean {
    if (
      !this.config.get<string>('GOOGLE_CLIENT_ID') ||
      !this.config.get<string>('GOOGLE_CLIENT_SECRET')
    ) {
      throw new ServiceUnavailableException(
        'Đăng nhập bằng Google chưa được cấu hình trên máy chủ',
      );
    }
    return true;
  }
}
