import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSubjects, fetchTopics } from '../../../features/subjects/subjectsApi';
import { createQuestion } from '../../../features/questions/questionsApi';
import { getApiErrorMessage } from '../../../lib/api-client';
import { useToast } from '../../../components/ToastProvider';
import { ErrorState } from '../../../components/StateViews';
import type { DifficultyLevel, QuestionType } from '../../../types/api';
import { TYPE_LABEL } from './adminQuestionsConstants';

export function CreateQuestionForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [subjectId, setSubjectId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [type, setType] = useState<QuestionType>('MULTIPLE_CHOICE');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('KNOWLEDGE');
  const [content, setContent] = useState('');
  const [options, setOptions] = useState(['', '', '', '']);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [trueFalse, setTrueFalse] = useState([true, false, false, false]);
  const [shortAnswerValue, setShortAnswerValue] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const subjectsQuery = useQuery({ queryKey: ['subjects'], queryFn: fetchSubjects });
  const topicsQuery = useQuery({
    queryKey: ['topics', subjectId],
    queryFn: () => fetchTopics(subjectId),
    enabled: !!subjectId,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createQuestion({
        subjectId,
        topicId,
        type,
        difficulty,
        content,
        options: type === 'MULTIPLE_CHOICE' ? options.filter(Boolean) : undefined,
        correctAnswer:
          type === 'MULTIPLE_CHOICE'
            ? { index: correctIndex }
            : type === 'TRUE_FALSE'
              ? { statements: trueFalse }
              : type === 'SHORT_ANSWER'
                ? { value: shortAnswerValue }
                : undefined,
      }),
    onSuccess: () => {
      showToast('Đã tạo câu hỏi vào kho dùng chung', 'success');
      queryClient.invalidateQueries({ queryKey: ['admin-questions'] });
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
    <form onSubmit={handleSubmit} className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto">
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
      <textarea
        required
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Nội dung câu hỏi"
        rows={3}
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
      />

      {type === 'MULTIPLE_CHOICE' && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">Các lựa chọn (chọn radio cho đáp án đúng)</p>
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="radio" checked={correctIndex === i} onChange={() => setCorrectIndex(i)} />
              <input
                value={opt}
                onChange={(e) => {
                  const next = [...options];
                  next[i] = e.target.value;
                  setOptions(next);
                }}
                placeholder={`Lựa chọn ${i + 1}`}
                className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
          ))}
        </div>
      )}

      {type === 'TRUE_FALSE' && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">Đáp án đúng cho từng ý a, b, c, d</p>
          {trueFalse.map((val, i) => (
            <label key={i} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={val}
                onChange={(e) => {
                  const next = [...trueFalse];
                  next[i] = e.target.checked;
                  setTrueFalse(next);
                }}
              />
              Ý {String.fromCharCode(97 + i)} đúng
            </label>
          ))}
        </div>
      )}

      {type === 'SHORT_ANSWER' && (
        <input
          required
          value={shortAnswerValue}
          onChange={(e) => setShortAnswerValue(e.target.value)}
          placeholder="Đáp án đúng"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
        />
      )}

      {formError && <ErrorState message={formError} />}
      <button
        type="submit"
        disabled={createMutation.isPending}
        className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
      >
        {createMutation.isPending ? 'Đang tạo...' : 'Tạo câu hỏi'}
      </button>
    </form>
  );
}
