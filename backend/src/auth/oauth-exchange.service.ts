import { randomUUID } from 'node:crypto';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

// Google trả về accessToken/refreshToken qua googleCallback() bằng một
// redirect trình duyệt (GET) — không thể đặt token thẳng vào query string vì
// URL bị log ở proxy/trình duyệt/lịch sử. Thay vào đó: cấp một mã dùng MỘT
// LẦN, sống rất ngắn, để frontend đổi lấy token thật qua POST
// /auth/oauth/exchange (xem AuthController).
//
// Lưu trong Redis (không còn Map trong bộ nhớ tiến trình) — một Map chỉ sống
// được khi backend chạy đúng 1 instance; chạy nhiều instance sau load
// balancer (scale ngang) thì request tạo mã và request đổi mã có thể rơi vào
// hai tiến trình khác nhau, khiến đổi mã luôn thất bại "ngẫu nhiên" tuỳ
// instance nào nhận request. Redis dùng chung giữa mọi instance giải quyết
// việc này, và TTL tự nhiên của Redis thay cho việc tự quét dọn mã hết hạn.
interface ExchangeEntry {
  accessToken: string;
  refreshToken: string;
}

const CODE_TTL_SECONDS = 60;
const KEY_PREFIX = 'oauth-exchange:';

@Injectable()
export class OAuthExchangeService implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(config: ConfigService) {
    this.redis = new Redis({
      host: config.get<string>('REDIS_HOST') ?? 'localhost',
      port: Number(config.get<string>('REDIS_PORT') ?? 6379),
      password: config.get<string>('REDIS_PASSWORD') || undefined,
    });
  }

  async create(accessToken: string, refreshToken: string): Promise<string> {
    const code = randomUUID();
    const entry: ExchangeEntry = { accessToken, refreshToken };
    await this.redis.set(
      `${KEY_PREFIX}${code}`,
      JSON.stringify(entry),
      'EX',
      CODE_TTL_SECONDS,
    );
    return code;
  }

  // Dùng một lần: GETDEL đọc và xoá nguyên tử trong một round-trip — hai
  // request đổi cùng một mã gần như đồng thời (double-click, tab kép) không
  // thể cả hai cùng đọc thành công như khi tách GET rồi DEL riêng.
  async redeem(
    code: string,
  ): Promise<{ accessToken: string; refreshToken: string } | null> {
    const raw = await this.redis.getdel(`${KEY_PREFIX}${code}`);
    if (!raw) return null;
    const entry = JSON.parse(raw) as ExchangeEntry;
    return { accessToken: entry.accessToken, refreshToken: entry.refreshToken };
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
