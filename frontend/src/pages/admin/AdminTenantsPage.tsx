import { useQuery } from '@tanstack/react-query';
import { fetchTenants } from '../../features/admin/adminApi';
import { getApiErrorMessage } from '../../lib/api-client';
import { EmptyState, ErrorState, LoadingState } from '../../components/StateViews';

export function AdminTenantsPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ['admin-tenants'], queryFn: fetchTenants });

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-900 dark:text-slate-100">Trung tâm / Giáo viên</h1>
      {isLoading && <LoadingState />}
      {error && <ErrorState message={getApiErrorMessage(error)} />}
      {data && data.length === 0 && <EmptyState label="Chưa có trung tâm nào." />}

      <div className="space-y-3">
        {data?.map((tenant) => (
          <div key={tenant.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
            <p className="font-medium text-slate-900 dark:text-slate-100">{tenant.name}</p>
            <p className="text-xs text-slate-500">
              Chủ sở hữu: {tenant.owner.fullName} ({tenant.owner.email})
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {tenant._count.classes} lớp · {tenant._count.questions} câu hỏi riêng · {tenant._count.exams} đề thi
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
