import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { approveQuestion, fetchQuestions, rejectQuestion } from '../../features/questions/questionsApi';
import { getApiErrorMessage } from '../../lib/api-client';
import { useToast } from '../../components/ToastProvider';
import { Modal } from '../../components/Modal';
import { EmptyState, ErrorState, LoadingState } from '../../components/StateViews';
import type { ContentStatus, Question } from '../../types/api';

const TABS: { value: ContentStatus | ''; label: string }[] = [
  { value: 'PENDING_APPROVAL', label: 'Chờ duyệt' },
  { value: 'APPROVED', label: 'Đã duyệt' },
  { value: 'REJECTED', label: 'Bị từ chối' },
  { value: 'DRAFT', label: 'Nháp' },
  { value: '', label: 'Tất cả' },
];

export function AdminQuestionsPage() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [status, setStatus] = useState<ContentStatus | ''>('PENDING_APPROVAL');
  const [rejecting, setRejecting] = useState<Question | null>(null);
  const [reason, setReason] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-questions', status],
    queryFn: () => fetchQuestions(status || undefined),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-questions'] });

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveQuestion(id),
    onSuccess: () => {
      showToast('Đã duyệt câu hỏi vào kho dùng chung', 'success');
      invalidate();
    },
    onError: (err) => showToast(getApiErrorMessage(err), 'error'),
  });

  const rejectMutation = useMutation({
    mutationFn: () => rejectQuestion(rejecting!.id, reason || undefined),
    onSuccess: () => {
      showToast('Đã từ chối câu hỏi', 'success');
      setRejecting(null);
      setReason('');
      invalidate();
    },
    onError: (err) => showToast(getApiErrorMessage(err), 'error'),
  });

  function handleReject(e: FormEvent) {
    e.preventDefault();
    rejectMutation.mutate();
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-slate-900 dark:text-slate-100">Duyệt câu hỏi</h1>
      <div className="mb-6 flex gap-2 text-sm">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatus(tab.value)}
            className={`rounded-lg border px-3 py-1.5 ${
              status === tab.value
                ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                : 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-400'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading && <LoadingState />}
      {error && <ErrorState message={getApiErrorMessage(error)} />}
      {data && data.length === 0 && <EmptyState label="Không có câu hỏi nào ở trạng thái này." />}

      <div className="space-y-3">
        {data?.map((q) => (
          <div key={q.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
            <p className="mb-2 font-medium text-slate-900 dark:text-slate-100">{q.content}</p>
            {q.status === 'PENDING_APPROVAL' && (
              <div className="flex gap-2">
                <button
                  onClick={() => approveMutation.mutate(q.id)}
                  disabled={approveMutation.isPending}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                >
                  Duyệt
                </button>
                <button
                  onClick={() => setRejecting(q)}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white"
                >
                  Từ chối
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {rejecting && (
        <Modal title="Từ chối câu hỏi" onClose={() => setRejecting(null)}>
          <form onSubmit={handleReject} className="flex flex-col gap-3">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Lý do từ chối (tuỳ chọn)"
              rows={3}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
            <button
              type="submit"
              disabled={rejectMutation.isPending}
              className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white disabled:opacity-50"
            >
              {rejectMutation.isPending ? 'Đang lưu...' : 'Xác nhận từ chối'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
