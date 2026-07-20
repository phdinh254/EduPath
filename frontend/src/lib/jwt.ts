import type { Role } from '../types/api';

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  tenantId?: string;
  exp: number;
  iat: number;
}

// Chỉ dùng để đọc thông tin hiển thị (role, tenantId) phía client cho việc điều hướng.
// KHÔNG dùng để quyết định quyền truy cập dữ liệu - mọi kiểm tra quyền thật sự nằm ở backend.
export function decodeJwt(token: string): JwtPayload | null {
  try {
    const [, payload] = token.split('.');
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decodeURIComponent(escape(json))) as JwtPayload;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  const payload = decodeJwt(token);
  if (!payload) return true;
  return payload.exp * 1000 <= Date.now();
}
