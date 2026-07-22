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

export async function refreshRequest(refreshToken: string): Promise<AuthTokens> {
  const { data } = await apiClient.post<AuthTokens>('/auth/refresh', { refreshToken });
  return data;
}

export async function logoutRequest(refreshToken: string): Promise<void> {
  await apiClient.post('/auth/logout', { refreshToken });
}
