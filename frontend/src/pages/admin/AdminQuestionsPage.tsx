import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSubjects, fetchTopics } from '../../features/subjects/subjectsApi';
import {
  approveQuestion,
  commitImportedQuestions,
  createQuestion,
  fetchQuestions,
  generateQuestions,
  parseExamImport,
  rejectQuestion,
  type ParsedImportQuestion,
} from '../../features/questions/questionsApi';
import { getApiErrorMessage } from '../../lib/api-client';
import { useToast } from '../../components/ToastProvider';
import { Modal } from '../../components/Modal';
import { EmptyState, ErrorState, LoadingState } from '../../components/StateViews';
import { Badge, Button, Card, PageHeader } from '../../components/ui/Card';
import { HelpCircleIcon } from '../../components/ui/Icons';
import type { ContentStatus, DifficultyLevel, Question, QuestionType } from '../../types/api';

const TABS: { value: ContentStatus | ''; label: string }[] = [
  { value: 'PENDING_APPROVAL', label: 'Chờ duyệt' },
  { value: 'APPROVED', label: 'Đã duyệt' },
  { value: 'REJECTED', label: 'Bị từ chối' },
  { value: '', label: 'Tất cả' },
];

const TYPE_LABEL: Record<QuestionType, string> = {
  MULTIPLE_CHOICE: 'Trắc nghiệm nhiều lựa chọn',
  TRUE_FALSE: 'Đúng/sai',
  SHORT_ANSWER: 'Trả lời ngắn',
  ESSAY: 'Tự luận',
};

const SOURCE_LABEL: Record<Question['source'], { label: string; variant: 'indigo' | 'slate' | 'violet' }> = {
  IMPORTED_REAL: { label: 'Đề thi thật', variant: 'indigo' },
  ADMIN_MANUAL: { label: 'Admin soạn', variant: 'slate' },
  AI_GENERATED: { label: 'AI sinh', variant: 'violet' },
};

function CreateQuestionForm({ onDone }: { onDone: () => void }) {
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

function GenerateQuestionsForm({ onDone }: { onDone: () => void }) {
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

// Nháp một câu hỏi đã tách — thêm topicId (khớp tự động theo tên chuyên đề
// gợi ý, hoặc để trống để ADMIN tự chọn) và include (bỏ chọn để loại câu này
// khỏi lần nhập, vd. AI tách nhầm/không cần thiết) so với dữ liệu AI trả về.
interface DraftQuestion extends ParsedImportQuestion {
  topicId: string;
  include: boolean;
}

function ImportExamForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [subjectId, setSubjectId] = useState('');
  const [rawText, setRawText] = useState('');
  const [drafts, setDrafts] = useState<DraftQuestion[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const subjectsQuery = useQuery({ queryKey: ['subjects'], queryFn: fetchSubjects });
  const topicsQuery = useQuery({
    queryKey: ['topics', subjectId],
    queryFn: () => fetchTopics(subjectId),
    enabled: !!subjectId,
  });

  const parseMutation = useMutation({
    mutationFn: () => parseExamImport(subjectId, rawText),
    onSuccess: (parsed) => {
      const topics = topicsQuery.data ?? [];
      setDrafts(
        parsed.map((p) => {
          const matched = topics.find(
            (t) => t.name.trim().toLowerCase() === p.suggestedTopicName.trim().toLowerCase(),
          );
          return { ...p, topicId: matched?.id ?? '', include: true };
        }),
      );
    },
    onError: (err) => setFormError(getApiErrorMessage(err)),
  });

  const commitMutation = useMutation({
    mutationFn: () => {
      const items = (drafts ?? [])
        .filter((d) => d.include)
        .map((d) => ({
          topicId: d.topicId,
          type: d.type,
          difficulty: d.suggestedDifficulty,
          content: d.content,
          options: d.options ?? undefined,
          correctAnswer: d.correctAnswer ?? undefined,
          explanation: d.explanation ?? undefined,
        }));
      return commitImportedQuestions(subjectId, items);
    },
    onSuccess: ({ count }) => {
      showToast(`Đã nhập ${count} câu hỏi thật vào kho dùng chung`, 'success');
      queryClient.invalidateQueries({ queryKey: ['admin-questions'] });
      onDone();
    },
    onError: (err) => setFormError(getApiErrorMessage(err)),
  });

  function updateDraft(index: number, patch: Partial<DraftQuestion>) {
    setDrafts((prev) => prev?.map((d, i) => (i === index ? { ...d, ...patch } : d)) ?? null);
  }

  const includedCount = drafts?.filter((d) => d.include).length ?? 0;
  const missingTopicCount = drafts?.filter((d) => d.include && !d.topicId).length ?? 0;

  // Bước 1: chưa có bản nháp — chọn môn + dán văn bản đề thi.
  if (!drafts) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-xs text-slate-500">
          Dán nguyên văn một đề thi thật (thi thử/đề chính thức các năm trước). AI sẽ tách thành câu hỏi có
          cấu trúc để bạn rà soát trước khi đưa vào kho — chưa lưu gì ở bước này.
        </p>
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
        <textarea
          required
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder="Dán văn bản đề thi vào đây..."
          rows={10}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
        />
        {formError && <ErrorState message={formError} />}
        <button
          type="button"
          disabled={!subjectId || rawText.trim().length < 20 || parseMutation.isPending}
          onClick={() => {
            setFormError(null);
            parseMutation.mutate();
          }}
          className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
        >
          {parseMutation.isPending ? 'AI đang phân tích...' : 'Phân tích'}
        </button>
      </div>
    );
  }

  // Bước 2: rà soát bản nháp — mỗi câu có thể sửa nội dung, gán chuyên đề, bỏ qua.
  return (
    <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
      <p className="text-xs text-slate-500">
        Tìm thấy {drafts.length} câu hỏi. Rà soát lại trước khi ghi vào kho — chỉnh nội dung, gán đúng
        chuyên đề, bỏ chọn câu không cần dùng.
      </p>
      {drafts.map((d, i) => (
        <div
          key={i}
          className={`rounded-xl border p-3 ${d.include ? 'border-slate-200 dark:border-slate-700' : 'border-slate-100 opacity-50 dark:border-slate-800'}`}
        >
          <div className="mb-2 flex items-center gap-2">
            <input type="checkbox" checked={d.include} onChange={(e) => updateDraft(i, { include: e.target.checked })} />
            <span className="text-xs font-medium text-slate-500">{TYPE_LABEL[d.type]}</span>
          </div>
          <textarea
            value={d.content}
            onChange={(e) => updateDraft(i, { content: e.target.value })}
            rows={2}
            className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
          <div className="flex flex-wrap gap-2">
            <select
              value={d.topicId}
              onChange={(e) => updateDraft(i, { topicId: e.target.value })}
              className={`rounded-lg border px-2.5 py-1.5 text-xs dark:bg-slate-900 ${
                d.include && !d.topicId ? 'border-red-400' : 'border-slate-300 dark:border-slate-700'
              }`}
            >
              <option value="">Chọn chuyên đề (gợi ý: {d.suggestedTopicName})</option>
              {topicsQuery.data?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <select
              value={d.suggestedDifficulty}
              onChange={(e) => updateDraft(i, { suggestedDifficulty: e.target.value as DifficultyLevel })}
              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="KNOWLEDGE">Nhận biết</option>
              <option value="COMPREHENSION">Thông hiểu</option>
              <option value="APPLICATION">Vận dụng</option>
              <option value="HIGH_APPLICATION">Vận dụng cao</option>
            </select>
          </div>
        </div>
      ))}
      {missingTopicCount > 0 && (
        <p className="text-xs text-red-600 dark:text-red-400">
          Còn {missingTopicCount} câu chưa chọn chuyên đề — cần chọn trước khi xác nhận.
        </p>
      )}
      {formError && <ErrorState message={formError} />}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setDrafts(null)}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300"
        >
          Quay lại
        </button>
        <button
          type="button"
          disabled={includedCount === 0 || missingTopicCount > 0 || commitMutation.isPending}
          onClick={() => {
            setFormError(null);
            commitMutation.mutate();
          }}
          className="flex-1 rounded-lg bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
        >
          {commitMutation.isPending ? 'Đang lưu...' : `Xác nhận nhập ${includedCount} câu vào kho`}
        </button>
      </div>
    </div>
  );
}

export function AdminQuestionsPage() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [status, setStatus] = useState<ContentStatus | ''>('PENDING_APPROVAL');
  const [showCreate, setShowCreate] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [showImport, setShowImport] = useState(false);
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
      <PageHeader
        title="Câu hỏi"
        subtitle="Ngân hàng câu hỏi dùng chung — tạo thủ công hoặc để AI tự soạn nội dung mới"
        icon={<HelpCircleIcon className="h-5 w-5" />}
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowImport(true)}>
              + Nhập đề thật
            </Button>
            <Button variant="secondary" onClick={() => setShowGenerate(true)}>
              + AI sinh câu hỏi
            </Button>
            <Button onClick={() => setShowCreate(true)}>+ Tạo thủ công</Button>
          </>
        }
      />

      <div className="mb-6 flex flex-wrap gap-2 text-sm">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatus(tab.value)}
            className={`rounded-xl border px-3.5 py-1.5 font-medium transition ${
              status === tab.value
                ? 'border-transparent bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm'
                : 'border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
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
          <Card key={q.id} className="p-4">
            <div className="mb-1 flex items-start justify-between gap-3">
              <p className="font-medium text-slate-900 dark:text-slate-100">{q.content}</p>
              <Badge
                variant={q.status === 'APPROVED' ? 'emerald' : q.status === 'REJECTED' ? 'red' : 'amber'}
                className="shrink-0"
              >
                {q.status === 'APPROVED' ? 'Đã duyệt' : q.status === 'REJECTED' ? 'Bị từ chối' : 'Chờ duyệt'}
              </Badge>
            </div>
            <div className="mb-2 flex items-center gap-2">
              <p className="text-xs text-slate-500">{TYPE_LABEL[q.type]}</p>
              <Badge variant={SOURCE_LABEL[q.source].variant}>{SOURCE_LABEL[q.source].label}</Badge>
            </div>
            {q.status === 'REJECTED' && q.rejectReason && (
              <p className="mb-2 text-xs text-red-600 dark:text-red-400">Lý do từ chối: {q.rejectReason}</p>
            )}
            {(q.status === 'PENDING_APPROVAL' || q.status === 'APPROVED') && (
              <div className="flex gap-2">
                {q.status === 'PENDING_APPROVAL' && (
                  <Button
                    variant="success"
                    onClick={() => approveMutation.mutate(q.id)}
                    disabled={approveMutation.isPending}
                    className="px-3 py-1.5 text-xs"
                  >
                    Duyệt
                  </Button>
                )}
                <Button variant="danger" onClick={() => setRejecting(q)} className="px-3 py-1.5 text-xs">
                  {q.status === 'APPROVED' ? 'Rút khỏi kho chung' : 'Từ chối'}
                </Button>
              </div>
            )}
          </Card>
        ))}
      </div>

      {showCreate && (
        <Modal title="Tạo câu hỏi thủ công" onClose={() => setShowCreate(false)}>
          <CreateQuestionForm onDone={() => setShowCreate(false)} />
        </Modal>
      )}

      {showGenerate && (
        <Modal title="AI sinh câu hỏi mới" onClose={() => setShowGenerate(false)}>
          <GenerateQuestionsForm onDone={() => setShowGenerate(false)} />
        </Modal>
      )}

      {showImport && (
        <Modal title="Nhập câu hỏi từ đề thi thật" onClose={() => setShowImport(false)}>
          <ImportExamForm onDone={() => setShowImport(false)} />
        </Modal>
      )}

      {rejecting && (
        <Modal title="Từ chối / rút câu hỏi" onClose={() => setRejecting(null)}>
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
              {rejectMutation.isPending ? 'Đang lưu...' : 'Xác nhận'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
