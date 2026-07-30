import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

// ThrottlerGuard mặc định chỉ dùng req.ip làm tracker. Sau khi bật trust
// proxy (xem main.ts), req.ip đã là IP client thật — nhưng nhiều học sinh
// dùng chung một mạng trường học/NAT vẫn dùng chung một IP công cộng. Nếu
// chỉ dựa vào IP, 5 học sinh khác nhau đăng ký gần như đồng thời từ cùng
// trường có thể tự khoá lẫn nhau (xem P0 issue #2).
//
// Kết hợp thêm email đã chuẩn hoá (trim + lowercase) lấy từ body request khi
// có — hai người dùng khác email từ cùng IP không còn dùng chung một bộ đếm,
// trong khi một người/kẻ tấn công dò mật khẩu từ IP đó vào MỘT email cụ thể
// vẫn bị giới hạn đúng như trước. Route không có field email trong body (vd.
// hầu hết endpoint ngoài auth) rơi về đúng hành vi cũ (chỉ IP).
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const ip = await super.getTracker(req);
    const email = (req as { body?: { email?: unknown } }).body?.email;
    const normalizedEmail =
      typeof email === 'string' ? email.trim().toLowerCase() : '';
    return normalizedEmail ? `${ip}:${normalizedEmail}` : ip;
  }
}
