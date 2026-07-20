import { useQuery } from '@tanstack/react-query';
import { fetchStats } from '../../features/admin/adminApi';
import { getApiErrorMessage } from '../../lib/api-client';
import { ErrorState, LoadingState } from '../../components/StateViews';

export function AdminStatsPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ['admin-stats'], queryFn: fetchStats });

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={getApiErrorMessage(error)} />;
  if (!data) return null;

  const tiles = [
    { label: 'Học sinh', value: data.totalStudents },
    { label: 'Giáo viên', value: data.totalTeachers },
    { label: 'Trung tâm', value: data.totalTenants },
    { label: 'Môn học', value: data.totalSubjects },
    { label: 'Đề thi', value: data.totalExams },
    { label: 'Lượt làm bài', value: data.totalAttempts },
  ];

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-900 dark:text-slate-100">Thống kê hệ thống</h1>
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{tile.value}</p>
            <p className="text-sm text-slate-500">{tile.label}</p>
          </div>
        ))}
      </div>

      <h2 className="mb-3 text-lg font-medium text-slate-900 dark:text-slate-100">Câu hỏi theo trạng thái</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
          <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{data.questionsByStatus.draft}</p>
          <p className="text-sm text-slate-500">Nháp</p>
        </div>
        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
          <p className="text-xl font-bold text-amber-600">{data.questionsByStatus.pendingApproval}</p>
          <p className="text-sm text-slate-500">Chờ duyệt</p>
        </div>
        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
          <p className="text-xl font-bold text-emerald-600">{data.questionsByStatus.approved}</p>
          <p className="text-sm text-slate-500">Đã duyệt</p>
        </div>
        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
          <p className="text-xl font-bold text-red-600">{data.questionsByStatus.rejected}</p>
          <p className="text-sm text-slate-500">Bị từ chối</p>
        </div>
      </div>
    </div>
  );
}
