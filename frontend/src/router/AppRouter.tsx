import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { AppLayout } from '../components/AppLayout';
import { LoginPage } from '../pages/auth/LoginPage';
import { RegisterPage } from '../pages/auth/RegisterPage';

import { StudentSubjectsPage } from '../pages/student/StudentSubjectsPage';
import { StudentClassesPage } from '../pages/student/StudentClassesPage';
import { StudentExamsPage } from '../pages/student/StudentExamsPage';
import { StudentExamAttemptPage } from '../pages/student/StudentExamAttemptPage';
import { StudentResultPage } from '../pages/student/StudentResultPage';
import { StudentRoadmapPage } from '../pages/student/StudentRoadmapPage';

import { TeacherDashboardPage } from '../pages/teacher/TeacherDashboardPage';
import { TeacherClassesPage } from '../pages/teacher/TeacherClassesPage';
import { TeacherClassDetailPage } from '../pages/teacher/TeacherClassDetailPage';
import { TeacherQuestionsPage } from '../pages/teacher/TeacherQuestionsPage';
import { TeacherExamsPage } from '../pages/teacher/TeacherExamsPage';
import { TeacherExamDetailPage } from '../pages/teacher/TeacherExamDetailPage';
import { TeacherPendingReviewPage } from '../pages/teacher/TeacherPendingReviewPage';

import { AdminStatsPage } from '../pages/admin/AdminStatsPage';
import { AdminUsersPage } from '../pages/admin/AdminUsersPage';
import { AdminTenantsPage } from '../pages/admin/AdminTenantsPage';
import { AdminSubjectsPage } from '../pages/admin/AdminSubjectsPage';
import { AdminQuestionsPage } from '../pages/admin/AdminQuestionsPage';
import { AdminAuditLogsPage } from '../pages/admin/AdminAuditLogsPage';

function HomeRedirect() {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  const home = { STUDENT: '/student', TEACHER: '/teacher', ADMIN: '/admin' }[user.role];
  return <Navigate to={home} replace />;
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<ProtectedRoute allowedRoles={['STUDENT']} />}>
        <Route element={<AppLayout />}>
          <Route path="/student" element={<StudentSubjectsPage />} />
          <Route path="/student/classes" element={<StudentClassesPage />} />
          <Route path="/student/exams" element={<StudentExamsPage />} />
          <Route path="/student/exams/:examId/attempt" element={<StudentExamAttemptPage />} />
          <Route path="/student/attempts/:attemptId/result" element={<StudentResultPage />} />
          <Route path="/student/roadmap" element={<StudentRoadmapPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['TEACHER']} />}>
        <Route element={<AppLayout />}>
          <Route path="/teacher" element={<TeacherDashboardPage />} />
          <Route path="/teacher/classes" element={<TeacherClassesPage />} />
          <Route path="/teacher/classes/:classId" element={<TeacherClassDetailPage />} />
          <Route path="/teacher/questions" element={<TeacherQuestionsPage />} />
          <Route path="/teacher/exams" element={<TeacherExamsPage />} />
          <Route path="/teacher/exams/:examId" element={<TeacherExamDetailPage />} />
          <Route path="/teacher/pending-review" element={<TeacherPendingReviewPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
        <Route element={<AppLayout />}>
          <Route path="/admin" element={<AdminStatsPage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/tenants" element={<AdminTenantsPage />} />
          <Route path="/admin/subjects" element={<AdminSubjectsPage />} />
          <Route path="/admin/questions" element={<AdminQuestionsPage />} />
          <Route path="/admin/audit-logs" element={<AdminAuditLogsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
