import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { setUnauthorizedHandler } from '../../lib/api-client';
import type { UserProfile } from '../../types/api';
import { fetchMe, loginRequest, registerRequest, type LoginPayload, type RegisterPayload } from './authApi';

interface AuthContextValue {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<UserProfile>;
  register: (payload: RegisterPayload) => Promise<UserProfile>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
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

  const login = useCallback(async (payload: LoginPayload) => {
    const tokens = await loginRequest(payload);
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    const profile = await fetchMe();
    setUser(profile);
    return profile;
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const tokens = await registerRequest(payload);
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    const profile = await fetchMe();
    setUser(profile);
    return profile;
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth phải được dùng bên trong AuthProvider');
  return ctx;
}
