import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';

// Google trả về accessToken/refreshToken qua googleCallback() bằng một
// redirect trình duyệt (GET) — không thể đặt token thẳng vào query string vì
// URL bị log ở proxy/trình duyệt/lịch sử. Thay vào đó: cấp một mã dùng MỘT
// LẦN, sống rất ngắn, để frontend đổi lấy token thật qua POST
// /auth/oauth/exchange (xem AuthController). Lưu trong memory vì mã chỉ sống
// vài giây và app hiện chạy single-instance — không cần Redis.
interface ExchangeEntry {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

const CODE_TTL_MS = 60_000;

@Injectable()
export class OAuthExchangeService {
  private readonly codes = new Map<string, ExchangeEntry>();

  create(accessToken: string, refreshToken: string): string {
    this.sweepExpired();
    const code = randomUUID();
    this.codes.set(code, {
      accessToken,
      refreshToken,
      expiresAt: Date.now() + CODE_TTL_MS,
    });
    return code;
  }

  // Dùng một lần: xoá ngay khi đọc, dù thành công hay hết hạn.
  redeem(code: string): { accessToken: string; refreshToken: string } | null {
    const entry = this.codes.get(code);
    this.codes.delete(code);
    if (!entry || entry.expiresAt < Date.now()) {
      return null;
    }
    return { accessToken: entry.accessToken, refreshToken: entry.refreshToken };
  }

  private sweepExpired(): void {
    const now = Date.now();
    for (const [code, entry] of this.codes) {
      if (entry.expiresAt < now) this.codes.delete(code);
    }
  }
}
