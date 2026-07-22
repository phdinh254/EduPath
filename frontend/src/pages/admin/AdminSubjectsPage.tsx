import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createSubject,
  createTopic,
  fetchExamStructure,
  fetchSubjects,
  fetchTopics,
  upsertExamStructure,
  type ExamStructureItemPayload,
} from '../../features/subjects/subjectsApi';
import { getApiErrorMessage } from '../../lib/api-client';
import { useToast } from '../../components/ToastProvider';
import { Modal } from '../../components/Modal';
import { EmptyState, ErrorState, LoadingState } from '../../components/StateViews';
import type { DifficultyLevel, QuestionType } from '../../types/api';

const TYPE_LABEL: Record<QuestionType, string> = {
  MULTIPLE_CHOICE: 'Trắc nghiệm nhiều lựa chọn',
  TRUE_FALSE: 'Đúng/sai',
  SHORT_ANSWER: 'Trả lời ngắn',
  ESSAY: 'Tự luận',
};

const DIFFICULTY_LABEL: Record<DifficultyLevel, string> = {
  KNOWLEDGE: 'Nhận biết',
  COMPREHENSION: 'Thông hiểu',
  APPLICATION: 'Vận dụng',
  HIGH_APPLICATION: 'Vận dụng cao',
};

function ExamStructurePanel({ subjectId }: { subjectId: string }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const structureQuery = useQuery({
    queryKey: ['exam-structure', subjectId],
    queryFn: () => fetchExamStructure(subjectId),
  });

  const [editing, setEditing] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState(90);
  const [items, setItems] = useState<ExamStructureItemPayload[]>([]);

  function startEditing() {
    const current = structureQuery.data;
    setDurationMinutes(current?.durationMinutes ?? 90);
    setItems(
      current?.items.map((i) => ({
        type: i.type,
        difficulty: i.difficulty,
        questionCount: i.questionCount,
        maxScorePerQuestion: i.maxScorePerQuestion,
      })) ?? [{ type: 'MULTIPLE_CHOICE', difficulty: 'KNOWLEDGE', questionCount: 10, maxScorePerQuestion: 0.25 }],
    );
    setEditing(true);
  }

  function updateItem(index: number, patch: Partial<ExamStructureItemPayload>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      { type: 'MULTIPLE_CHOICE', difficulty: 'KNOWLEDGE', questionCount: 1, maxScorePerQuestion: 0.25 },
    ]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  const saveMutation = useMutation({
    mutationFn: () => upsertExamStructure(subjectId, { durationMinutes, items }),
    onSuccess: () => {
      showToast('Đã lưu cấu trúc đề', 'success');
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ['exam-structure', subjectId] });
    },
    onError: (err) => showToast(getApiErrorMessage(err), 'error'),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (items.length === 0) return;
    saveMutation.mutate();
  }

  const totalScore = (structureQuery.data?.items ?? []).reduce(
    (sum, i) => sum + i.questionCount * i.maxScorePerQuestion,
    0,
  );

  return (
    <div className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-800">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">Cấu trúc đề cố định (THPT)</h3>
        {!editing && (
          <button
            onClick={startEditing}
            className="rounded-lg border border-slate-300 px-3 py-1 text-xs dark:border-slate-700"
          >
            {structureQuery.data ? 'Sửa' : '+ Khai báo cấu trúc'}
          </button>
        )}
      </div>

      {structureQuery.isLoading && <LoadingState label="Đang tải cấu trúc đề..." />}

      {!editing && structureQuery.data && (
        <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
          <p>Thời gian làm bài mặc định: {structureQuery.data.durationMinutes} phút</p>
          <ul className="list-disc pl-5">
            {structureQuery.data.items.map((item) => (
              <li key={item.id}>
                {TYPE_LABEL[item.type]} · {DIFFICULTY_LABEL[item.difficulty]}: {item.questionCount} câu ×{' '}
                {item.maxScorePerQuestion}đ
              </li>
            ))}
          </ul>
          <p>Tổng điểm đề: {totalScore}</p>
        </div>
      )}

      {!editing && !structureQuery.isLoading && !structureQuery.data && (
        <p className="text-xs text-slate-500">
          Chưa cấu hình — AI ghép đề cho môn này sẽ báo lỗi cho tới khi khai báo cấu trúc.
        </p>
      )}

      {editing && (
        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block text-xs text-slate-500">
            Thời gian làm bài mặc định (phút)
            <input
              type="number"
              min={1}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
          </label>

          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-5 items-center gap-2 rounded-lg border border-slate-200 p-2 dark:border-slate-800">
                <select
                  value={item.type}
                  onChange={(e) => updateItem(i, { type: e.target.value as QuestionType })}
                  className="rounded-lg border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                >
                  {Object.entries(TYPE_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <select
                  value={item.difficulty}
                  onChange={(e) => updateItem(i, { difficulty: e.target.value as DifficultyLevel })}
                  className="rounded-lg border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                >
                  {Object.entries(DIFFICULTY_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  value={item.questionCount}
                  onChange={(e) => updateItem(i, { questionCount: Number(e.target.value) })}
                  placeholder="Số câu"
                  className="rounded-lg border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                />
                <input
                  type="number"
                  min={0}
                  step={0.05}
                  value={item.maxScorePerQuestion}
                  onChange={(e) => updateItem(i, { maxScorePerQuestion: Number(e.target.value) })}
                  placeholder="Điểm/câu"
                  className="rounded-lg border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                />
                <button
                  type="button"
                  onClick={() => removeItem(i)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Xoá
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addItem}
            className="rounded-lg border border-slate-300 px-3 py-1 text-xs dark:border-slate-700"
          >
            + Thêm dạng câu
          </button>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saveMutation.isPending || items.length === 0}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
            >
              {saveMutation.isPending ? 'Đang lưu...' : 'Lưu cấu trúc'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-slate-700"
            >
              Huỷ
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

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
            {expanded === subject.id && (
              <>
                <TopicsPanel subjectId={subject.id} />
                <ExamStructurePanel subjectId={subject.id} />
              </>
            )}
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
