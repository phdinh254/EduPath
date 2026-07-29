import axios, { type InternalAxiosRequestConfig } from 'axios';
import type { ApiErrorBody, AuthTokens } from '../types/api';

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

// Access token chỉ giữ trong bộ nhớ (biến module), KHÔNG lưu localStorage —
// mất khi tải lại trang, AuthProvider tự phục hồi bằng /auth/refresh (dựa
// vào cookie refreshToken HttpOnly, không cần đọc lại token cũ). Mục tiêu:
// một lỗ hổng XSS ở bất kỳ đâu trong SPA không thể đọc trộm token từ storage.
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  // Cần thiết để trình duyệt gửi kèm cookie refreshToken HttpOnly tới
  // /auth/refresh và /auth/logout kể cả khi frontend/backend khác origin.
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Gọi khi phiên đăng nhập hết hạn và không thể refresh - AuthProvider đăng ký hàm này để tự đăng xuất.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

// Gộp các request 401 xảy ra đồng thời lại thành một lần gọi /auth/refresh duy nhất.
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  // Không gửi refreshToken trong body — cookie HttpOnly được trình duyệt tự
  // đính kèm, xem AuthController.refresh().
  const { data } = await axios.post<AuthTokens>(
    `${apiClient.defaults.baseURL}/auth/refresh`,
    {},
    { withCredentials: true },
  );
  setAccessToken(data.accessToken);
  return data.accessToken;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error) || error.response?.status !== 401) {
      return Promise.reject(error);
    }

    const originalRequest = error.config as RetryableRequestConfig | undefined;
    const isAuthEndpoint = originalRequest?.url?.startsWith('/auth/');
    if (!originalRequest || originalRequest._retry || isAuthEndpoint) {
      onUnauthorized?.();
      return Promise.reject(error);
    }

    originalRequest._retry = true;
    try {
      refreshPromise ??= refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
      const newAccessToken = await refreshPromise;
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      return apiClient(originalRequest);
    } catch {
      onUnauthorized?.();
      return Promise.reject(error);
    }
  },
);

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    const body = error.response?.data;
    if (body?.message) {
      return Array.isArray(body.message) ? body.message.join(', ') : body.message;
    }
    if (error.code === 'ERR_NETWORK') {
      return 'Không thể kết nối tới máy chủ. Vui lòng kiểm tra kết nối mạng.';
    }
  }
  return 'Đã xảy ra lỗi không xác định. Vui lòng thử lại.';
}
