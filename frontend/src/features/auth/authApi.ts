import { apiClient } from '../../lib/api-client';
import type { AuthTokens, UserProfile } from '../../types/api';

// Đăng ký công khai luôn tạo tài khoản STUDENT — không còn chọn vai trò.
export interface RegisterPayload {
  email: string;
  password: string;
  fullName: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export async function registerRequest(payload: RegisterPayload): Promise<AuthTokens> {
  const { data } = await apiClient.post<AuthTokens>('/auth/register', payload);
  return data;
}

export async function loginRequest(payload: LoginPayload): Promise<AuthTokens> {
  const { data } = await apiClient.post<AuthTokens>('/auth/login', payload);
  return data;
}

export async function fetchMe(): Promise<UserProfile> {
  const { data } = await apiClient.get<UserProfile>('/users/me');
  return data;
}

// refreshToken không còn truyền qua body — cookie HttpOnly được gửi tự động.
export async function refreshRequest(): Promise<AuthTokens> {
  const { data } = await apiClient.post<AuthTokens>('/auth/refresh', {});
  return data;
}

export async function logoutRequest(): Promise<void> {
  await apiClient.post('/auth/logout', {});
}

// Đổi mã dùng một lần (nhận từ query string sau khi Google redirect về
// /auth/callback) lấy accessToken thật — xem AuthController.exchangeOAuthCode.
export async function exchangeOAuthCodeRequest(code: string): Promise<AuthTokens> {
  const { data } = await apiClient.post<AuthTokens>('/auth/oauth/exchange', { code });
  return data;
}

// Điều hướng cả trang (không phải XHR) sang backend để bắt đầu luồng OAuth
// Google — backend sẽ redirect tiếp sang Google rồi quay về /auth/callback.
export function googleAuthUrl(): string {
  return `${apiClient.defaults.baseURL}/auth/google`;
}
