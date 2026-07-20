import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createSubject, createTopic, fetchSubjects, fetchTopics } from '../../features/subjects/subjectsApi';
import { getApiErrorMessage } from '../../lib/api-client';
import { useToast } from '../../components/ToastProvider';
import { Modal } from '../../components/Modal';
import { EmptyState, ErrorState, LoadingState } from '../../components/StateViews';

function TopicsPanel({ subjectId }: { subjectId: string }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [topicName, setTopicName] = useState('');
  const { data, isLoading, error } = useQuery({ queryKey: ['topics', subjectId], queryFn: () => fetchTopics(subjectId) });

  const createTopicMutation = useMutation({
    mutationFn: () => createTopic(subjectId, { name: topicName }),
    onSuccess: () => {
      showToast('Đã thêm chuyên đề', 'success');
      setTopicName('');
      queryClient.invalidateQueries({ queryKey: ['topics', subjectId] });
    },
    onError: (err) => showToast(getApiErrorMessage(err), 'error'),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!topicName.trim()) return;
    createTopicMutation.mutate();
  }

  return (
    <div className="mt-3">
      {isLoading && <LoadingState label="Đang tải chuyên đề..." />}
      {error && <ErrorState message={getApiErrorMessage(error)} />}
      {data && data.length === 0 && <EmptyState label="Chưa có chuyên đề." />}
      <ul className="mb-3 list-disc pl-5 text-sm text-slate-600 dark:text-slate-400">
        {data?.map((t) => (
          <li key={t.id}>{t.name}</li>
        ))}
      </ul>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={topicName}
          onChange={(e) => setTopicName(e.target.value)}
          placeholder="Tên chuyên đề mới"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
        />
        <button
          type="submit"
          disabled={createTopicMutation.isPending}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700"
        >
          Thêm
        </button>
      </form>
    </div>
  );
}

export function AdminSubjectsPage() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({ queryKey: ['subjects'], queryFn: fetchSubjects });

  const createMutation = useMutation({
    mutationFn: () => createSubject({ code, name }),
    onSuccess: () => {
      showToast('Đã tạo môn học', 'success');
      setShowCreate(false);
      setCode('');
      setName('');
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
    },
    onError: (err) => setFormError(getApiErrorMessage(err)),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    createMutation.mutate();
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Môn học &amp; chuyên đề</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-slate-900"
        >
          + Tạo môn học
        </button>
      </div>

      {isLoading && <LoadingState />}
      {error && <ErrorState message={getApiErrorMessage(error)} />}
      {data && data.length === 0 && <EmptyState label="Chưa có môn học nào." />}

      <div className="space-y-3">
        {data?.map((subject) => (
          <div key={subject.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
            <button
              onClick={() => setExpanded(expanded === subject.id ? null : subject.id)}
              className="flex w-full items-center justify-between text-left font-medium text-slate-900 dark:text-slate-100"
            >
              {subject.name} ({subject.code})
              <span className="text-slate-400">{expanded === subject.id ? '−' : '+'}</span>
            </button>
            {expanded === subject.id && <TopicsPanel subjectId={subject.id} />}
          </div>
        ))}
      </div>

      {showCreate && (
        <Modal title="Tạo môn học mới" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Mã môn (ví dụ: TOAN)"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tên môn học"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
            {formError && <ErrorState message={formError} />}
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
            >
              {createMutation.isPending ? 'Đang tạo...' : 'Tạo môn học'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
