import { useQuery } from '@tanstack/react-query';
import { fetchAuditLogs } from '../../features/admin/adminApi';
import { getApiErrorMessage } from '../../lib/api-client';
import { EmptyState, ErrorState, LoadingState } from '../../components/StateViews';

export function AdminAuditLogsPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ['audit-logs'], queryFn: fetchAuditLogs });

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-900 dark:text-slate-100">Audit log</h1>
      {isLoading && <LoadingState />}
      {error && <ErrorState message={getApiErrorMessage(error)} />}
      {data && data.length === 0 && <EmptyState label="Chưa có hoạt động nào được ghi nhận." />}

      <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
        {data?.map((log) => (
          <div key={log.id} className="border-b border-slate-200 p-4 text-sm last:border-b-0 dark:border-slate-800">
            <p className="font-medium text-slate-900 dark:text-slate-100">
              {log.action} · {log.entityType}
            </p>
            <p className="text-xs text-slate-500">
              {log.user?.fullName ?? 'Hệ thống'} · {new Date(log.createdAt).toLocaleString('vi-VN')}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
