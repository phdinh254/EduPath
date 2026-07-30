import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

// Passport-oauth2 state store hoàn toàn stateless (không cần session/cookie
// riêng để TRA CỨU) — chống CSRF cho luồng Google OAuth bằng nonce ngẫu
// nhiên + timestamp ký HMAC, tự xác minh chữ ký và hạn dùng ở bước callback
// thay vì phải tra một session server-side. Phù hợp với kiến trúc hiện tại
// (JWT thuần, không có express-session).
//
// Chỉ ký HMAC là CHƯA đủ: một state hợp lệ có thể bị đánh cắp qua URL/log và
// dùng lại (replay) bởi một trình duyệt khác trước khi hết hạn — kẻ tấn công
// có thể ép nạn nhân hoàn tất luồng OAuth bằng session của kẻ tấn công (OAuth
// login CSRF). Để chặn: khi store() cấp state, đồng thời đặt một cookie
// HttpOnly ngẫu nhiên riêng trên chính trình duyệt đó; verify() chỉ chấp
// nhận state nếu giá trị nhúng trong state khớp với cookie đọc được từ CHÍNH
// request đó — trình duyệt của kẻ tấn công không có cookie này. Cookie luôn
// bị xoá ngay khi verify() chạy (dù thành công hay thất bại) nên state không
// thể tái sử dụng được lần thứ hai (chống replay).
const STATE_TTL_MS = 5 * 60_000;
const BINDING_COOKIE_NAME = 'oauth_state_binding';
// Phải là prefix chung của cả /auth/google (nơi đặt cookie) và
// /auth/google/callback (nơi đọc lại) để trình duyệt gửi kèm cookie ở bước
// callback — xem AuthController.REFRESH_COOKIE_PATH cho quy ước tương tự.
const BINDING_COOKIE_PATH = '/api/auth/google';

type StoreCallback = (err: Error | null, state: string) => void;
type VerifyCallback = (err: Error | null, ok: boolean, info?: unknown) => void;

export class StatelessOAuthStateStore {
  constructor(private readonly secret: string) {}

  private sign(payload: string): string {
    return createHmac('sha256', this.secret).update(payload).digest('hex');
  }

  store(req: Request, callback: StoreCallback): void;
  store(req: Request, meta: unknown, callback: StoreCallback): void;
  store(
    req: Request,
    metaOrCallback: unknown,
    maybeCallback?: StoreCallback,
  ): void {
    const callback = (maybeCallback ?? metaOrCallback) as StoreCallback;
    const nonce = randomBytes(16).toString('hex');
    const browserBinding = randomBytes(16).toString('hex');
    const issuedAt = Date.now().toString();
    const payload = `${nonce}.${issuedAt}.${browserBinding}`;

    // Express luôn gán req.res <-> res.req cho nhau trong vòng đời một
    // request thật (xem Express Application#handle) — an toàn khi truy cập
    // trực tiếp ở đây, khác với việc phải nhận res qua tham số (StateStore
    // API của passport-oauth2 không truyền res vào store()/verify()).
    req.res?.cookie(BINDING_COOKIE_NAME, browserBinding, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: STATE_TTL_MS,
      path: BINDING_COOKIE_PATH,
    });

    callback(null, `${payload}.${this.sign(payload)}`);
  }

  verify(req: Request, state: string, callback: VerifyCallback): void;
  verify(
    req: Request,
    state: string,
    meta: unknown,
    callback: VerifyCallback,
  ): void;
  verify(
    req: Request,
    state: string,
    metaOrCallback: unknown,
    maybeCallback?: VerifyCallback,
  ): void {
    const callback = (maybeCallback ?? metaOrCallback) as VerifyCallback;
    const parts = typeof state === 'string' ? state.split('.') : [];

    // Xoá cookie binding NGAY LẬP TỨC, không phụ thuộc kết quả xác minh bên
    // dưới — đảm bảo mỗi cookie chỉ dùng thử được đúng một lần (chống replay
    // kể cả với chính trình duyệt hợp lệ).
    req.res?.clearCookie(BINDING_COOKIE_NAME, { path: BINDING_COOKIE_PATH });

    if (parts.length !== 4) {
      callback(null, false, 'state không đúng định dạng');
      return;
    }
    const [nonce, issuedAt, browserBinding, signature] = parts;
    const expected = this.sign(`${nonce}.${issuedAt}.${browserBinding}`);
    const expectedBuf = Buffer.from(expected);
    const signatureBuf = Buffer.from(signature);
    if (
      expectedBuf.length !== signatureBuf.length ||
      !timingSafeEqual(expectedBuf, signatureBuf)
    ) {
      callback(null, false, 'state không hợp lệ');
      return;
    }
    if (Date.now() - Number(issuedAt) > STATE_TTL_MS) {
      callback(null, false, 'state đã hết hạn');
      return;
    }

    const cookieBinding = (req.cookies as Record<string, string> | undefined)?.[
      BINDING_COOKIE_NAME
    ];
    if (!cookieBinding || cookieBinding !== browserBinding) {
      callback(null, false, 'state không khớp trình duyệt khởi tạo');
      return;
    }

    callback(null, true);
  }
}
