import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { setUnauthorizedHandler } from '../../lib/api-client';
import type { AuthTokens, UserProfile } from '../../types/api';
import {
  fetchMe,
  loginRequest,
  logoutRequest,
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
    const storedRefreshToken = localStorage.getItem('refreshToken');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
    // Thu hồi refresh token phía server, không cần chờ kết quả (best-effort).
    if (storedRefreshToken) {
      logoutRequest(storedRefreshToken).catch(() => {});
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
  }, [logout]);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setIsLoading(false);
      return;
    }
    fetchMe()
      .then(setUser)
      .catch(() => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
      })
      .finally(() => setIsLoading(false));
  }, []);

  // Lưu token rồi tải hồ sơ — dùng chung cho login bằng mật khẩu, đăng ký,
  // và luồng quay về từ Google OAuth (token đã cấp sẵn qua query string).
  const applyTokens = useCallback(async (tokens: AuthTokens) => {
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
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
