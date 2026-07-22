import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { AppLayout } from '../components/AppLayout';
import { LandingPage } from '../pages/LandingPage';
import { LoginPage } from '../pages/auth/LoginPage';
import { RegisterPage } from '../pages/auth/RegisterPage';

import { StudentSubjectsPage } from '../pages/student/StudentSubjectsPage';
import { StudentExamsPage } from '../pages/student/StudentExamsPage';
import { StudentExamAttemptPage } from '../pages/student/StudentExamAttemptPage';
import { StudentResultPage } from '../pages/student/StudentResultPage';
import { StudentRoadmapPage } from '../pages/student/StudentRoadmapPage';

import { AdminStatsPage } from '../pages/admin/AdminStatsPage';
import { AdminUsersPage } from '../pages/admin/AdminUsersPage';
import { AdminSubjectsPage } from '../pages/admin/AdminSubjectsPage';
import { AdminQuestionsPage } from '../pages/admin/AdminQuestionsPage';
import { AdminExamsPage } from '../pages/admin/AdminExamsPage';
import { AdminExamDetailPage } from '../pages/admin/AdminExamDetailPage';
import { AdminPendingReviewPage } from '../pages/admin/AdminPendingReviewPage';
import { AdminAuditLogsPage } from '../pages/admin/AdminAuditLogsPage';

// Khách chưa đăng nhập thấy trang giới thiệu; đã đăng nhập thì vào thẳng
// trang chủ theo vai trò của mình.
function RootRoute() {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user) return <LandingPage />;
  const home = { STUDENT: '/student', ADMIN: '/admin' }[user.role];
  return <Navigate to={home} replace />;
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<RootRoute />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<ProtectedRoute allowedRoles={['STUDENT']} />}>
        <Route element={<AppLayout />}>
          <Route path="/student" element={<StudentSubjectsPage />} />
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
  );
}
