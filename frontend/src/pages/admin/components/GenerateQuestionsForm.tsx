import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSubjects, fetchTopics } from '../../../features/subjects/subjectsApi';
import { generateQuestions } from '../../../features/questions/questionsApi';
import { getApiErrorMessage } from '../../../lib/api-client';
import { useToast } from '../../../components/ToastProvider';
import { ErrorState } from '../../../components/StateViews';
import type { DifficultyLevel, QuestionType } from '../../../types/api';
import { TYPE_LABEL } from './adminQuestionsConstants';

export function GenerateQuestionsForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [subjectId, setSubjectId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [type, setType] = useState<QuestionType>('MULTIPLE_CHOICE');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('KNOWLEDGE');
  const [count, setCount] = useState(10);
  const [formError, setFormError] = useState<string | null>(null);

  const subjectsQuery = useQuery({ queryKey: ['subjects'], queryFn: fetchSubjects });
  const topicsQuery = useQuery({
    queryKey: ['topics', subjectId],
    queryFn: () => fetchTopics(subjectId),
    enabled: !!subjectId,
  });

  const generateMutation = useMutation({
    mutationFn: () => generateQuestions({ subjectId, topicId, type, difficulty, count }),
    onSuccess: (created) => {
      showToast(`AI đã sinh ${created.length} câu hỏi, đang chờ duyệt`, 'success');
      queryClient.invalidateQueries({ queryKey: ['admin-questions'] });
      onDone();
    },
    onError: (err) => setFormError(getApiErrorMessage(err)),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    generateMutation.mutate();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <p className="text-xs text-slate-500">
        AI sinh nội dung mới (không sao chép nguyên văn đề thi/tài liệu bản quyền), vào hàng chờ duyệt.
      </p>
      <select
        required
        value={subjectId}
        onChange={(e) => {
          setSubjectId(e.target.value);
          setTopicId('');
        }}
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
      >
        <option value="">Chọn môn học</option>
        {subjectsQuery.data?.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <select
        required
        value={topicId}
        onChange={(e) => setTopicId(e.target.value)}
        disabled={!subjectId}
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
      >
        <option value="">Chọn chuyên đề</option>
        {topicsQuery.data?.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <select
        value={type}
        onChange={(e) => setType(e.target.value as QuestionType)}
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
      >
        {Object.entries(TYPE_LABEL).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <select
        value={difficulty}
        onChange={(e) => setDifficulty(e.target.value as DifficultyLevel)}
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
      >
        <option value="KNOWLEDGE">Nhận biết</option>
        <option value="COMPREHENSION">Thông hiểu</option>
        <option value="APPLICATION">Vận dụng</option>
        <option value="HIGH_APPLICATION">Vận dụng cao</option>
      </select>
      <input
        type="number"
        min={1}
        max={100}
        required
        value={count}
        onChange={(e) => setCount(Number(e.target.value))}
        placeholder="Số lượng câu hỏi"
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
      />
      {formError && <ErrorState message={formError} />}
      <button
        type="submit"
        disabled={generateMutation.isPending}
        className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
      >
        {generateMutation.isPending ? 'Đang sinh câu hỏi...' : 'AI sinh câu hỏi'}
      </button>
    </form>
  );
}
