import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';
import { getApiErrorMessage } from '../../lib/api-client';
import { useToast } from '../../components/ToastProvider';
import type { Role } from '../../types/api';

const HOME_BY_ROLE: Record<Role, string> = {
  STUDENT: '/student',
  TEACHER: '/teacher',
  ADMIN: '/admin',
};

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="mb-6 text-center text-2xl font-semibold text-slate-900 dark:text-slate-100">
        Đăng nhập
      </h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-sm text-slate-600 dark:text-slate-400">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-600 dark:text-slate-400">Mật khẩu</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
        >
          {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-500">
        Chưa có tài khoản?{' '}
        <Link to="/register" className="font-medium text-slate-900 underline dark:text-slate-100">
          Đăng ký
        </Link>
      </p>
    </main>
  );
}
