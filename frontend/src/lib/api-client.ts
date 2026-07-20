import axios from 'axios';
import type { ApiErrorBody } from '../types/api';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Gọi khi phiên đăng nhập hết hạn (401) - AuthProvider đăng ký hàm này để tự đăng xuất.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      onUnauthorized?.();
    }
    return Promise.reject(error);
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
