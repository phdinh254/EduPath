import { type ReactNode } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { Logo } from './Logo';
import { NotificationBell } from './NotificationBell';
import { StreakBadge } from './StreakBadge';
import { BadgeEarnedWatcher } from './BadgeEarnedWatcher';
import {
  BookIcon,
  ChartIcon,
  ClipboardCheckIcon,
  FileTextIcon,
  HelpCircleIcon,
  LogIcon,
  LogOutIcon,
  RouteIcon,
  UsersIcon,
} from './ui/Icons';

const NAV_BY_ROLE: Record<'STUDENT' | 'ADMIN', { to: string; label: string; end?: boolean; icon: ReactNode }[]> = {
  STUDENT: [
    { to: '/student/exams', label: 'Kho đề thi', icon: <FileTextIcon className="h-[18px] w-[18px]" /> },
    { to: '/student/roadmap', label: 'Lộ trình AI', icon: <RouteIcon className="h-[18px] w-[18px]" /> },
  ],
  ADMIN: [
    { to: '/admin', label: 'Thống kê', end: true, icon: <ChartIcon className="h-[18px] w-[18px]" /> },
    { to: '/admin/users', label: 'Người dùng', icon: <UsersIcon className="h-[18px] w-[18px]" /> },
    { to: '/admin/subjects', label: 'Môn học', icon: <BookIcon className="h-[18px] w-[18px]" /> },
    { to: '/admin/questions', label: 'Câu hỏi', icon: <HelpCircleIcon className="h-[18px] w-[18px]" /> },
    { to: '/admin/exams', label: 'Đề thi', icon: <FileTextIcon className="h-[18px] w-[18px]" /> },
    { to: '/admin/pending-review', label: 'Hậu kiểm Văn', icon: <ClipboardCheckIcon className="h-[18px] w-[18px]" /> },
    { to: '/admin/audit-logs', label: 'Audit log', icon: <LogIcon className="h-[18px] w-[18px]" /> },
  ],
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;
  const navItems = NAV_BY_ROLE[user.role];

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-3">
          <div className="flex shrink-0 items-center">
            <Logo size={26} />
          </div>
          <nav className="hidden flex-1 items-center justify-center gap-1 md:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end ?? false}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm shadow-indigo-500/30'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                  }`
                }
              >
                {item.icon}
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-3">
            {user.role === 'STUDENT' && (
              <>
                <BadgeEarnedWatcher />
                <StreakBadge />
                <NotificationBell />
              </>
            )}
            <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 py-1 pl-1 pr-3 dark:border-slate-800">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-semibold text-white">
                {initials(user.fullName)}
              </span>
              <div className="hidden text-left sm:block">
                <p className="text-xs font-medium leading-tight text-slate-900 dark:text-slate-100">{user.fullName}</p>
                <p className="text-[11px] leading-tight text-slate-400">
                  {user.role === 'ADMIN' ? 'Quản trị viên' : 'Học sinh'}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Đăng xuất"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 text-slate-500 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-red-900 dark:hover:bg-red-950/40 dark:hover:text-red-400"
            >
              <LogOutIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-4 pb-2 md:hidden">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end ?? false}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
