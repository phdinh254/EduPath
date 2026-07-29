import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

// Passport-oauth2 state store hoàn toàn stateless (không cần session/cookie
// riêng) — chống CSRF cho luồng Google OAuth bằng nonce ngẫu nhiên + timestamp
// ký HMAC, tự xác minh chữ ký và hạn dùng ở bước callback thay vì phải tra
// một session server-side. Phù hợp với kiến trúc hiện tại (JWT thuần, không
// có express-session). Chữ ký overload khớp với `oauth2.StateStore` của
// passport-oauth2 (store/verify đều có bản 2 và 3 tham số).
const STATE_TTL_MS = 5 * 60_000;

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
    _req: Request,
    metaOrCallback: unknown,
    maybeCallback?: StoreCallback,
  ): void {
    const callback = (maybeCallback ?? metaOrCallback) as StoreCallback;
    const nonce = randomBytes(16).toString('hex');
    const issuedAt = Date.now().toString();
    const payload = `${nonce}.${issuedAt}`;
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
    _req: Request,
    state: string,
    metaOrCallback: unknown,
    maybeCallback?: VerifyCallback,
  ): void {
    const callback = (maybeCallback ?? metaOrCallback) as VerifyCallback;
    const parts = typeof state === 'string' ? state.split('.') : [];
    if (parts.length !== 3) {
      callback(null, false, 'state không đúng định dạng');
      return;
    }
    const [nonce, issuedAt, signature] = parts;
    const expected = this.sign(`${nonce}.${issuedAt}`);
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
    callback(null, true);
  }
}
