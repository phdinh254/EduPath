import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';
import { fetchMyClasses } from '../../features/classes/classesApi';
import { fetchExams } from '../../features/exams/examsApi';
import { fetchPendingReview } from '../../features/grading/gradingApi';
import { getApiErrorMessage } from '../../lib/api-client';
import { ErrorState, LoadingState } from '../../components/StateViews';

export function TeacherDashboardPage() {
  const { user } = useAuth();
  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: fetchMyClasses });
  const examsQuery = useQuery({ queryKey: ['exams'], queryFn: fetchExams });
  const pendingQuery = useQuery({ queryKey: ['pending-review'], queryFn: fetchPendingReview });

  const error = classesQuery.error || examsQuery.error || pendingQuery.error;

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
        {user?.ownedTenant?.name ?? 'Trung tâm của bạn'}
      </h1>
      <p className="mb-6 text-sm text-slate-500">Tổng quan hoạt động giảng dạy</p>
      {error && <ErrorState message={getApiErrorMessage(error)} />}
      {(classesQuery.isLoading || examsQuery.isLoading || pendingQuery.isLoading) && <LoadingState />}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link
          to="/teacher/classes"
          className="rounded-lg border border-slate-200 p-4 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
        >
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{classesQuery.data?.length ?? 0}</p>
          <p className="text-sm text-slate-500">Lớp học</p>
        </Link>
        <Link
          to="/teacher/exams"
          className="rounded-lg border border-slate-200 p-4 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
        >
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{examsQuery.data?.length ?? 0}</p>
          <p className="text-sm text-slate-500">Đề thi</p>
        </Link>
        <Link
          to="/teacher/pending-review"
          className="rounded-lg border border-slate-200 p-4 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
        >
          <p className="text-2xl font-bold text-amber-600">{pendingQuery.data?.length ?? 0}</p>
          <p className="text-sm text-slate-500">Bài Văn chờ duyệt</p>
        </Link>
      </div>
    </div>
  );
}
