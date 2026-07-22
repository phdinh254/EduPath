import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from './Logo';

const BENEFITS = [
  'Chấm điểm AI tức thời — kể cả bài tự luận Ngữ văn',
  'Đề chuẩn cấu trúc THPT 2025 & Đánh giá năng lực',
  'Lộ trình ôn tập cá nhân hoá đúng chỗ bạn đang yếu',
];

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
    <div className="flex min-h-screen bg-white dark:bg-slate-950">
      {/* Panel thương hiệu — chỉ hiện từ lg trở lên */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-indigo-600 to-violet-600 p-10 text-white lg:flex xl:p-14">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-white/10 blur-3xl"
        />
        <Link to="/">
          <Logo size={34} theme="light" />
        </Link>
        <div className="relative">
          <p className="mb-4 text-2xl font-bold leading-snug">
            Đang điểm thấp? Đừng để nó lặp lại ở kỳ thi thật.
          </p>
          <ul className="space-y-3 text-sm text-indigo-100">
            {BENEFITS.map((b) => (
              <li key={b} className="flex items-start gap-2">
                <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-white/15 text-xs">
                  ✓
                </span>
                {b}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-indigo-200">© {new Date().getFullYear()} EduPath</p>
      </div>

      {/* Form */}
      <div className="flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-1/2">
        <div className="mx-auto w-full max-w-sm">
          <Link to="/" className="mb-8 flex lg:hidden">
            <Logo size={30} />
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{title}</h1>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
