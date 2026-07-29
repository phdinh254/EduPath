import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';
import { exchangeOAuthCodeRequest } from '../../features/auth/authApi';
import { getApiErrorMessage } from '../../lib/api-client';
import { ErrorState, LoadingState } from '../../components/StateViews';

// Đích đến sau khi backend redirect về từ Google OAuth (xem AuthController.googleCallback),
// kèm một mã dùng một lần (không phải token thật — tránh lộ token qua query
// string/lịch sử trình duyệt) — đổi mã lấy accessToken thật qua POST
// /auth/oauth/exchange, refreshToken được backend đặt thẳng vào cookie HttpOnly.
export function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const { loginWithTokens } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const code = searchParams.get('code');
    if (!code) {
      setError('Thiếu mã đăng nhập trả về từ Google.');
      return;
    }
    exchangeOAuthCodeRequest(code)
      .then((tokens) => loginWithTokens(tokens))
      .then((profile) => {
        navigate(profile.role === 'ADMIN' ? '/admin' : '/student', { replace: true });
      })
      .catch((err: unknown) => setError(getApiErrorMessage(err)));
  }, [searchParams, loginWithTokens, navigate]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <ErrorState message={error} />
        <Link to="/login" className="text-sm font-medium text-indigo-600 underline dark:text-indigo-400">
          Quay lại đăng nhập
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <LoadingState label="Đang hoàn tất đăng nhập bằng Google..." />
    </div>
  );
}
