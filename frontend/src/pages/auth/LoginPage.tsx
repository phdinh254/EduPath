import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';
import { getApiErrorMessage } from '../../lib/api-client';
import { useToast } from '../../components/ToastProvider';
import { AuthShell } from '../../components/AuthShell';
import { GoogleButton } from '../../components/GoogleButton';
import { PasswordInput } from '../../components/PasswordInput';
import type { Role } from '../../types/api';

const HOME_BY_ROLE: Record<Role, string> = {
  STUDENT: '/student',
  ADMIN: '/admin',
};

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const profile = await login({ email, password });
      showToast('Đăng nhập thành công', 'success');
      navigate(HOME_BY_ROLE[profile.role], { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell title="Chào mừng trở lại!" subtitle="Bạn đã nhớ chúng tôi chưa? Đăng nhập để tiếp tục ôn luyện.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
          <input
            type="email"
            required
            placeholder="Nhập email của bạn"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Mật khẩu</label>
          <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" />
        </div>

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/40 dark:border-slate-700"
            />
            Ghi nhớ đăng nhập
          </label>
          <button
            type="button"
            onClick={() => showToast('Tính năng đặt lại mật khẩu đang được phát triển', 'info')}
            className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
          >
            Quên mật khẩu?
          </button>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-xl bg-indigo-600 px-4 py-2.5 font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-500 disabled:opacity-50"
        >
          {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>

        <GoogleButton label="Đăng nhập bằng Google" />
      </form>

      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        Chưa có tài khoản?{' '}
        <Link to="/register" className="font-semibold text-indigo-600 dark:text-indigo-400">
          Đăng ký ngay
        </Link>
      </p>
    </AuthShell>
  );
}
