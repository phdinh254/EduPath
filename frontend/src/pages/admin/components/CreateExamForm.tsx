import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSubjects } from '../../../features/subjects/subjectsApi';
import { createExam } from '../../../features/exams/examsApi';
import { getApiErrorMessage } from '../../../lib/api-client';
import { useToast } from '../../../components/ToastProvider';
import { ErrorState } from '../../../components/StateViews';

export function CreateExamForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [formError, setFormError] = useState<string | null>(null);

  const subjectsQuery = useQuery({ queryKey: ['subjects'], queryFn: fetchSubjects });

  const createMutation = useMutation({
    mutationFn: () => createExam({ title, category: 'THPT', subjectId, durationMinutes }),
    onSuccess: () => {
      showToast('Tạo đề thi thành công', 'success');
      queryClient.invalidateQueries({ queryKey: ['exams'] });
      onDone();
    },
    onError: (err) => setFormError(getApiErrorMessage(err)),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    createMutation.mutate();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <p className="text-xs text-slate-500">Tạo đề rỗng (1 môn) rồi thêm câu hỏi thủ công ở trang chi tiết.</p>
      <input
        required
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Tên đề thi"
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
      />
      <select
        required
        value={subjectId}
        onChange={(e) => setSubjectId(e.target.value)}
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
      >
        <option value="">Chọn môn học</option>
        {subjectsQuery.data?.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <input
        type="number"
        required
        min={1}
        value={durationMinutes}
        onChange={(e) => setDurationMinutes(Number(e.target.value))}
        placeholder="Thời gian làm bài (phút)"
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
      />
      {formError && <ErrorState message={formError} />}
      <button
        type="submit"
        disabled={createMutation.isPending}
        className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
      >
        {createMutation.isPending ? 'Đang tạo...' : 'Tạo đề thi'}
      </button>
    </form>
  );
}
