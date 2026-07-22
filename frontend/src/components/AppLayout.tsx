import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { Logo } from './Logo';

const NAV_BY_ROLE = {
  STUDENT: [
    { to: '/student', label: 'Môn học', end: true },
    { to: '/student/exams', label: 'Đề thi' },
    { to: '/student/roadmap', label: 'Lộ trình AI' },
  ],
  ADMIN: [
    { to: '/admin', label: 'Thống kê', end: true },
    { to: '/admin/users', label: 'Người dùng' },
    { to: '/admin/subjects', label: 'Môn học' },
    { to: '/admin/questions', label: 'Câu hỏi' },
    { to: '/admin/exams', label: 'Đề thi' },
    { to: '/admin/pending-review', label: 'Hậu kiểm điểm Văn' },
    { to: '/admin/audit-logs', label: 'Audit log' },
  ],
} as const;

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
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <Logo size={26} />
            <nav className="flex gap-4 text-sm">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={'end' in item ? item.end : false}
                  className={({ isActive }) =>
                    isActive
                      ? 'font-medium text-slate-900 dark:text-slate-100'
                      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-500 dark:text-slate-400">{user.fullName}</span>
            <button
              onClick={handleLogout}
              className="rounded-lg border border-slate-300 px-3 py-1 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
