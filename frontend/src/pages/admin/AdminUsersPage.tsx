import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchUsers, setUserActive } from '../../features/users/usersApi';
import { getApiErrorMessage } from '../../lib/api-client';
import { useToast } from '../../components/ToastProvider';
import { EmptyState, ErrorState, LoadingState } from '../../components/StateViews';
import type { Role } from '../../types/api';

const ROLE_LABEL: Record<Role, string> = { STUDENT: 'Học sinh', ADMIN: 'Quản trị viên' };

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
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Quản lý người dùng</h1>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as Role | '')}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
        >
          <option value="">Tất cả vai trò</option>
          <option value="STUDENT">Học sinh</option>
          <option value="ADMIN">Quản trị viên</option>
        </select>
      </div>

      {isLoading && <LoadingState />}
      {error && <ErrorState message={getApiErrorMessage(error)} />}
      {data && data.length === 0 && <EmptyState label="Không có người dùng nào." />}

      <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
        {data?.map((u) => (
          <div
            key={u.id}
            className="flex items-center justify-between border-b border-slate-200 p-4 last:border-b-0 dark:border-slate-800"
          >
            <div>
              <p className="font-medium text-slate-900 dark:text-slate-100">
                {u.fullName} <span className="text-xs font-normal text-slate-500">({ROLE_LABEL[u.role]})</span>
              </p>
              <p className="text-xs text-slate-500">{u.email}</p>
            </div>
            <button
              onClick={() => toggleMutation.mutate({ id: u.id, isActive: !u.isActive })}
              className={`rounded-lg border px-3 py-1 text-xs ${
                u.isActive
                  ? 'border-red-300 text-red-600 hover:bg-red-50 dark:border-red-900'
                  : 'border-emerald-300 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-900'
              }`}
            >
              {u.isActive ? 'Vô hiệu hoá' : 'Kích hoạt lại'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
