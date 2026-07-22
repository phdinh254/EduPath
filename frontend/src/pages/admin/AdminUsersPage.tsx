import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchUsers, setUserActive } from '../../features/users/usersApi';
import { getApiErrorMessage } from '../../lib/api-client';
import { useToast } from '../../components/ToastProvider';
import { EmptyState, ErrorState, LoadingState } from '../../components/StateViews';
import { Badge, Card, PageHeader } from '../../components/ui/Card';
import { UsersIcon } from '../../components/ui/Icons';
import type { Role } from '../../types/api';

const ROLE_LABEL: Record<Role, string> = { STUDENT: 'Học sinh', ADMIN: 'Quản trị viên' };

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

export function AdminUsersPage() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [roleFilter, setRoleFilter] = useState<Role | ''>('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-users', roleFilter],
    queryFn: () => fetchUsers(roleFilter || undefined),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => setUserActive(id, isActive),
    onSuccess: () => {
      showToast('Đã cập nhật trạng thái tài khoản', 'success');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err) => showToast(getApiErrorMessage(err), 'error'),
  });

  return (
    <div>
      <PageHeader
        title="Quản lý người dùng"
        subtitle="Danh sách tài khoản học sinh và quản trị viên trong hệ thống"
        icon={<UsersIcon className="h-5 w-5" />}
        actions={
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as Role | '')}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="">Tất cả vai trò</option>
            <option value="STUDENT">Học sinh</option>
            <option value="ADMIN">Quản trị viên</option>
          </select>
        }
      />

      {isLoading && <LoadingState />}
      {error && <ErrorState message={getApiErrorMessage(error)} />}
      {data && data.length === 0 && <EmptyState label="Không có người dùng nào." />}

      <Card className="divide-y divide-slate-100 overflow-hidden p-0 dark:divide-slate-800">
        {data?.map((u) => (
          <div key={u.id} className="flex items-center justify-between gap-4 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-semibold text-white">
                {initials(u.fullName)}
              </span>
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
                  <span className="truncate">{u.fullName}</span>
                  <Badge variant={u.role === 'ADMIN' ? 'violet' : 'indigo'}>{ROLE_LABEL[u.role]}</Badge>
                  {!u.isActive && <Badge variant="red">Đã vô hiệu hoá</Badge>}
                </p>
                <p className="truncate text-xs text-slate-500">{u.email}</p>
              </div>
            </div>
            <button
              onClick={() => toggleMutation.mutate({ id: u.id, isActive: !u.isActive })}
              className={`shrink-0 rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                u.isActive
                  ? 'border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40'
                  : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-400 dark:hover:bg-emerald-950/40'
              }`}
            >
              {u.isActive ? 'Vô hiệu hoá' : 'Kích hoạt lại'}
            </button>
          </div>
        ))}
      </Card>
    </div>
  );
}
