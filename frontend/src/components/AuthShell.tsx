import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from './Logo';

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-sky-400 via-indigo-500 to-violet-600 px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-0 h-80 w-80 rounded-full bg-white/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 bottom-0 h-96 w-96 rounded-full bg-indigo-300/25 blur-3xl"
      />

      <Link
        to="/"
        className="absolute left-4 top-4 flex items-center gap-1.5 text-sm font-medium text-white/90 transition hover:text-white sm:left-6 sm:top-6"
      >
        <span aria-hidden>←</span> Trang chủ
      </Link>

      <div className="relative flex w-full max-w-md flex-col items-center">
        <Link to="/" className="mb-6">
          <Logo size={30} theme="light" />
        </Link>

        <div className="w-full rounded-2xl bg-white p-7 shadow-2xl sm:p-8 dark:bg-slate-900">
          <h1 className="text-center text-xl font-bold text-slate-900 dark:text-white">{title}</h1>
          <p className="mt-1.5 text-center text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
