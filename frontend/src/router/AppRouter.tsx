import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { AppLayout } from '../components/AppLayout';
import { LoadingState } from '../components/StateViews';
import { LandingPage } from '../pages/LandingPage';
import { LoginPage } from '../pages/auth/LoginPage';
import { RegisterPage } from '../pages/auth/RegisterPage';
import { AuthCallbackPage } from '../pages/auth/AuthCallbackPage';

// Lazy-load mọi trang sau màn hình đăng nhập — mỗi trang tách thành chunk
// riêng, chỉ tải khi người dùng thực sự vào route đó thay vì gộp chung vào
// bundle chính (trước đây ~860KB cho một lần tải đầu).
const StudentExamsPage = lazy(() =>
  import('../pages/student/StudentExamsPage').then((m) => ({ default: m.StudentExamsPage })),
);
const StudentExamAttemptPage = lazy(() =>
  import('../pages/student/StudentExamAttemptPage').then((m) => ({ default: m.StudentExamAttemptPage })),
);
const StudentResultPage = lazy(() =>
  import('../pages/student/StudentResultPage').then((m) => ({ default: m.StudentResultPage })),
);
const StudentRoadmapPage = lazy(() =>
  import('../pages/student/StudentRoadmapPage').then((m) => ({ default: m.StudentRoadmapPage })),
);

const AdminStatsPage = lazy(() =>
  import('../pages/admin/AdminStatsPage').then((m) => ({ default: m.AdminStatsPage })),
);
const AdminUsersPage = lazy(() =>
  import('../pages/admin/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage })),
);
const AdminSubjectsPage = lazy(() =>
  import('../pages/admin/AdminSubjectsPage').then((m) => ({ default: m.AdminSubjectsPage })),
);
const AdminQuestionsPage = lazy(() =>
  import('../pages/admin/AdminQuestionsPage').then((m) => ({ default: m.AdminQuestionsPage })),
);
const AdminExamsPage = lazy(() =>
  import('../pages/admin/AdminExamsPage').then((m) => ({ default: m.AdminExamsPage })),
);
const AdminExamDetailPage = lazy(() =>
  import('../pages/admin/AdminExamDetailPage').then((m) => ({ default: m.AdminExamDetailPage })),
);
const AdminPendingReviewPage = lazy(() =>
  import('../pages/admin/AdminPendingReviewPage').then((m) => ({ default: m.AdminPendingReviewPage })),
);
const AdminAuditLogsPage = lazy(() =>
  import('../pages/admin/AdminAuditLogsPage').then((m) => ({ default: m.AdminAuditLogsPage })),
);

// Khách chưa đăng nhập thấy trang giới thiệu; đã đăng nhập thì vào thẳng
// trang chủ theo vai trò của mình.
function RootRoute() {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user) return <LandingPage />;
  const home = { STUDENT: '/student', ADMIN: '/admin' }[user.role];
  return <Navigate to={home} replace />;
}

function RouteFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <LoadingState label="Đang tải trang..." />
    </div>
  );
}

export function AppRouter() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<RootRoute />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />

        <Route element={<ProtectedRoute allowedRoles={['STUDENT']} />}>
          <Route element={<AppLayout />}>
            <Route path="/student" element={<Navigate to="/student/exams" replace />} />
            <Route path="/student/exams" element={<StudentExamsPage />} />
            <Route path="/student/exams/:examId/attempt" element={<StudentExamAttemptPage />} />
            <Route path="/student/attempts/:attemptId/result" element={<StudentResultPage />} />
            <Route path="/student/roadmap" element={<StudentRoadmapPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
          <Route element={<AppLayout />}>
            <Route path="/admin" element={<AdminStatsPage />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="/admin/subjects" element={<AdminSubjectsPage />} />
            <Route path="/admin/questions" element={<AdminQuestionsPage />} />
            <Route path="/admin/exams" element={<AdminExamsPage />} />
            <Route path="/admin/exams/:examId" element={<AdminExamDetailPage />} />
            <Route path="/admin/pending-review" element={<AdminPendingReviewPage />} />
            <Route path="/admin/audit-logs" element={<AdminAuditLogsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
