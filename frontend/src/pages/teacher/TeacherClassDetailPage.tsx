import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { fetchClassStudents, removeStudentFromClass } from '../../features/classes/classesApi';
import { getApiErrorMessage } from '../../lib/api-client';
import { useToast } from '../../components/ToastProvider';
import { Modal } from '../../components/Modal';
import { EmptyState, ErrorState, LoadingState } from '../../components/StateViews';
import type { StudentClassLink } from '../../types/api';

export function TeacherClassDetailPage() {
  const { classId } = useParams<{ classId: string }>();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [removing, setRemoving] = useState<StudentClassLink | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['class-students', classId],
    queryFn: () => fetchClassStudents(classId!),
    enabled: !!classId,
  });

  const removeMutation = useMutation({
    mutationFn: () => removeStudentFromClass(classId!, removing!.studentId),
    onSuccess: () => {
      showToast('Đã xoá học sinh khỏi lớp', 'success');
      setRemoving(null);
      queryClient.invalidateQueries({ queryKey: ['class-students', classId] });
    },
    onError: (err) => {
      showToast(getApiErrorMessage(err), 'error');
      setRemoving(null);
    },
  });

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-900 dark:text-slate-100">Danh sách học sinh</h1>
      {isLoading && <LoadingState />}
      {error && <ErrorState message={getApiErrorMessage(error)} />}
      {data && data.length === 0 && <EmptyState label="Lớp học chưa có học sinh nào." />}

      <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
        {data?.map((link) => (
          <div
            key={link.id}
            className="flex items-center justify-between border-b border-slate-200 p-4 last:border-b-0 dark:border-slate-800"
          >
            <div>
              <p className="font-medium text-slate-900 dark:text-slate-100">{link.student?.fullName}</p>
              <p className="text-xs text-slate-500">{link.student?.email}</p>
            </div>
            <button onClick={() => setRemoving(link)} className="text-sm text-red-500 hover:text-red-700">
              Xoá khỏi lớp
            </button>
          </div>
        ))}
      </div>

      {removing && (
        <Modal title="Xác nhận xoá học sinh" onClose={() => setRemoving(null)}>
          <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
            Xoá <strong>{removing.student?.fullName}</strong> khỏi lớp này?
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setRemoving(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-slate-700">
              Huỷ
            </button>
            <button
              onClick={() => removeMutation.mutate()}
              disabled={removeMutation.isPending}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {removeMutation.isPending ? 'Đang xoá...' : 'Xoá'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
