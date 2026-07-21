import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchMyEnrolledClasses,
  fetchPublicClasses,
  joinClassByInviteCode,
  joinPublicClass,
} from '../../features/classes/classesApi';
import { getApiErrorMessage } from '../../lib/api-client';
import { useToast } from '../../components/ToastProvider';
import { EmptyState, ErrorState, LoadingState } from '../../components/StateViews';

export function StudentClassesPage() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [inviteCode, setInviteCode] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['my-classes'],
    queryFn: fetchMyEnrolledClasses,
  });
  const publicClassesQuery = useQuery({
    queryKey: ['public-classes'],
    queryFn: fetchPublicClasses,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['my-classes'] });
    queryClient.invalidateQueries({ queryKey: ['public-classes'] });
  };

  const joinMutation = useMutation({
    mutationFn: () => joinClassByInviteCode(inviteCode.trim()),
    onSuccess: () => {
      showToast('Tham gia lớp thành công', 'success');
      setInviteCode('');
      setFormError(null);
      invalidate();
    },
    onError: (err) => setFormError(getApiErrorMessage(err)),
  });

  const joinPublicMutation = useMutation({
    mutationFn: (classId: string) => joinPublicClass(classId),
    onSuccess: () => {
      showToast('Tham gia lớp thành công', 'success');
      invalidate();
    },
    onError: (err) => showToast(getApiErrorMessage(err), 'error'),
  });

  function handleJoin(e: FormEvent) {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    joinMutation.mutate();
  }

  const myClassIds = new Set(data?.map((link) => link.classId));

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-900 dark:text-slate-100">Lớp học của tôi</h1>

      <form onSubmit={handleJoin} className="mb-6 flex max-w-md gap-2">
        <input
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
          placeholder="Nhập mã lớp (invite code)"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
        />
        <button
          type="submit"
          disabled={joinMutation.isPending}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
        >
          {joinMutation.isPending ? 'Đang tham gia...' : 'Tham gia lớp'}
        </button>
      </form>
      {formError && <ErrorState message={formError} />}

      <div className="mt-6">
        {isLoading && <LoadingState />}
        {error && <ErrorState message={getApiErrorMessage(error)} />}
        {data && data.length === 0 && <EmptyState label="Bạn chưa tham gia lớp học nào. Hãy nhập mã lớp ở trên." />}
        <div className="space-y-2">
          {data?.map((link) => (
            <div key={link.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
              <p className="font-medium text-slate-900 dark:text-slate-100">{link.class?.name}</p>
              <p className="text-xs text-slate-500">
                Tham gia lúc {new Date(link.joinedAt).toLocaleDateString('vi-VN')}
              </p>
            </div>
          ))}
        </div>
      </div>

      <h2 className="mb-4 mt-8 text-lg font-semibold text-slate-900 dark:text-slate-100">Lớp công khai có thể tham gia</h2>
      {publicClassesQuery.isLoading && <LoadingState />}
      {publicClassesQuery.error && <ErrorState message={getApiErrorMessage(publicClassesQuery.error)} />}
      {publicClassesQuery.data && publicClassesQuery.data.length === 0 && (
        <EmptyState label="Hiện chưa có lớp công khai nào." />
      )}
      <div className="space-y-2">
        {publicClassesQuery.data
          ?.filter((klass) => !myClassIds.has(klass.id))
          .map((klass) => (
            <div
              key={klass.id}
              className="flex items-center justify-between rounded-lg border border-slate-200 p-4 dark:border-slate-800"
            >
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-100">{klass.name}</p>
                <p className="text-xs text-slate-500">{klass.tenant?.name}</p>
              </div>
              <button
                onClick={() => joinPublicMutation.mutate(klass.id)}
                disabled={joinPublicMutation.isPending}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
              >
                Tham gia
              </button>
            </div>
          ))}
      </div>
    </div>
  );
}
