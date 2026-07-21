import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createClass, deleteClass, updateClass } from '../../features/classes/classesApi';
import { fetchMyClasses } from '../../features/classes/classesApi';
import { getApiErrorMessage } from '../../lib/api-client';
import { useToast } from '../../components/ToastProvider';
import { Modal } from '../../components/Modal';
import { EmptyState, ErrorState, LoadingState } from '../../components/StateViews';
import type { SchoolClass } from '../../types/api';

export function TeacherClassesPage() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<SchoolClass | null>(null);
  const [deleting, setDeleting] = useState<SchoolClass | null>(null);
  const [name, setName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({ queryKey: ['classes'], queryFn: fetchMyClasses });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['classes'] });

  const createMutation = useMutation({
    mutationFn: () => createClass({ name, isPublic }),
    onSuccess: () => {
      showToast('Tạo lớp thành công', 'success');
      setShowCreate(false);
      setName('');
      invalidate();
    },
    onError: (err) => setFormError(getApiErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: () => updateClass(editing!.id, { name, isPublic }),
    onSuccess: () => {
      showToast('Cập nhật lớp thành công', 'success');
      setEditing(null);
      invalidate();
    },
    onError: (err) => setFormError(getApiErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteClass(deleting!.id),
    onSuccess: () => {
      showToast('Đã xoá lớp học', 'success');
      setDeleting(null);
      invalidate();
    },
    onError: (err) => {
      showToast(getApiErrorMessage(err), 'error');
      setDeleting(null);
    },
  });

  function openCreate() {
    setName('');
    setIsPublic(false);
    setFormError(null);
    setShowCreate(true);
  }

  function openEdit(klass: SchoolClass) {
    setName(klass.name);
    setIsPublic(klass.isPublic);
    setFormError(null);
    setEditing(klass);
  }

  function handleSubmitCreate(e: FormEvent) {
    e.preventDefault();
    createMutation.mutate();
  }

  function handleSubmitEdit(e: FormEvent) {
    e.preventDefault();
    updateMutation.mutate();
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Lớp học</h1>
        <button
          onClick={openCreate}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-slate-900"
        >
          + Tạo lớp mới
        </button>
      </div>

      {isLoading && <LoadingState />}
      {error && <ErrorState message={getApiErrorMessage(error)} />}
      {data && data.length === 0 && <EmptyState label="Chưa có lớp học nào. Hãy tạo lớp đầu tiên." />}

      <div className="space-y-3">
        {data?.map((klass) => (
          <div
            key={klass.id}
            className="flex items-center justify-between rounded-lg border border-slate-200 p-4 dark:border-slate-800"
          >
            <div>
              <Link to={`/teacher/classes/${klass.id}`} className="font-medium text-slate-900 hover:underline dark:text-slate-100">
                {klass.name}
              </Link>
              <p className="text-xs text-slate-500">
                Mã mời: <span className="font-mono">{klass.inviteCode}</span>
                {klass.isPublic && ' · Công khai'}
              </p>
            </div>
            <div className="flex gap-2 text-sm">
              <button onClick={() => openEdit(klass)} className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
                Sửa
              </button>
              <button onClick={() => setDeleting(klass)} className="text-red-500 hover:text-red-700">
                Xoá
              </button>
            </div>
          </div>
        ))}
      </div>

      {showCreate && (
        <Modal title="Tạo lớp mới" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleSubmitCreate} className="flex flex-col gap-4">
            <input
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tên lớp"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
            />
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
              Công khai (học sinh có thể tự duyệt và tham gia không cần mã mời)
            </label>
            {formError && <ErrorState message={formError} />}
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
            >
              {createMutation.isPending ? 'Đang tạo...' : 'Tạo lớp'}
            </button>
          </form>
        </Modal>
      )}

      {editing && (
        <Modal title="Sửa tên lớp" onClose={() => setEditing(null)}>
          <form onSubmit={handleSubmitEdit} className="flex flex-col gap-4">
            <input
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
            />
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
              Công khai (học sinh có thể tự duyệt và tham gia không cần mã mời)
            </label>
            {formError && <ErrorState message={formError} />}
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
            >
              {updateMutation.isPending ? 'Đang lưu...' : 'Lưu'}
            </button>
          </form>
        </Modal>
      )}

      {deleting && (
        <Modal title="Xác nhận xoá lớp" onClose={() => setDeleting(null)}>
          <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
            Xoá lớp <strong>{deleting.name}</strong>? Học sinh trong lớp sẽ không còn thuộc lớp này. Hành động
            này không thể hoàn tác.
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setDeleting(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-slate-700">
              Huỷ
            </button>
            <button
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {deleteMutation.isPending ? 'Đang xoá...' : 'Xoá lớp'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
