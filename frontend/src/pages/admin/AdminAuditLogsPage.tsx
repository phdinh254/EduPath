import { useQuery } from '@tanstack/react-query';
import { fetchAuditLogs } from '../../features/admin/adminApi';
import { getApiErrorMessage } from '../../lib/api-client';
import { EmptyState, ErrorState, LoadingState } from '../../components/StateViews';
import { Card, PageHeader } from '../../components/ui/Card';
import { LogIcon } from '../../components/ui/Icons';

export function AdminAuditLogsPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ['audit-logs'], queryFn: fetchAuditLogs });

  return (
    <div>
      <PageHeader
        title="Audit log"
        subtitle="Nhật ký các thao tác quan trọng trong hệ thống"
        icon={<LogIcon className="h-5 w-5" />}
      />
      {isLoading && <LoadingState />}
      {error && <ErrorState message={getApiErrorMessage(error)} />}
      {data && data.length === 0 && <EmptyState label="Chưa có hoạt động nào được ghi nhận." />}

      <Card className="divide-y divide-slate-100 overflow-hidden p-0 dark:divide-slate-800">
        {data?.map((log) => (
          <div key={log.id} className="flex items-center gap-3 p-4 text-sm">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <LogIcon className="h-4 w-4" />
            </span>
            <div>
              <p className="font-medium text-slate-900 dark:text-slate-100">
                {log.action} · {log.entityType}
              </p>
              <p className="text-xs text-slate-500">
                {log.user?.fullName ?? 'Hệ thống'} · {new Date(log.createdAt).toLocaleString('vi-VN')}
              </p>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
