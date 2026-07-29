import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { setAccessToken, setUnauthorizedHandler } from '../../lib/api-client';
import type { AuthTokens, UserProfile } from '../../types/api';
import {
  fetchMe,
  loginRequest,
  logoutRequest,
  refreshRequest,
  registerRequest,
  type LoginPayload,
  type RegisterPayload,
} from './authApi';

interface AuthContextValue {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<UserProfile>;
  register: (payload: RegisterPayload) => Promise<UserProfile>;
  loginWithTokens: (tokens: AuthTokens) => Promise<UserProfile>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    // Thu hồi refresh token phía server (cookie HttpOnly), không cần chờ kết quả (best-effort).
    logoutRequest().catch(() => {});
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
  }, [logout]);

  // accessToken chỉ sống trong bộ nhớ (xem api-client.ts) nên mất khi tải lại
  // trang — phục hồi phiên đăng nhập bằng cách gọi /auth/refresh, dựa vào
  // cookie refreshToken HttpOnly mà trình duyệt tự gửi kèm.
  useEffect(() => {
    refreshRequest()
      .then(async (tokens) => {
        setAccessToken(tokens.accessToken);
        setUser(await fetchMe());
      })
      .catch(() => {
        setAccessToken(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  // Lưu accessToken rồi tải hồ sơ — dùng chung cho login bằng mật khẩu, đăng
  // ký, và luồng đổi mã dùng một lần sau khi quay về từ Google OAuth (xem
  // AuthCallbackPage). refreshToken không đi qua đây — backend đã đặt vào
  // cookie HttpOnly trực tiếp trong response của các request phát sinh tokens.
  const applyTokens = useCallback(async (tokens: AuthTokens) => {
    setAccessToken(tokens.accessToken);
    const profile = await fetchMe();
    setUser(profile);
    return profile;
  }, []);

  const login = useCallback(
    async (payload: LoginPayload) => applyTokens(await loginRequest(payload)),
    [applyTokens],
  );

  const register = useCallback(
    async (payload: RegisterPayload) => applyTokens(await registerRequest(payload)),
    [applyTokens],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        loginWithTokens: applyTokens,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth phải được dùng bên trong AuthProvider');
  return ctx;
}
