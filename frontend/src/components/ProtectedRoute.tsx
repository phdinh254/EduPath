import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import type { Role } from '../types/api';

export function ProtectedRoute({ allowedRoles }: { allowedRoles?: Role[] }) {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500 dark:text-slate-400">
        Đang tải...
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
