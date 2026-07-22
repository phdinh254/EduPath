import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchExamStructure, fetchSubjects } from '../../features/subjects/subjectsApi';
import {
  createExam,
  fetchExams,
  generateExam,
  type GenerateExamSectionPayload,
} from '../../features/exams/examsApi';
import { getApiErrorMessage } from '../../lib/api-client';
import { useToast } from '../../components/ToastProvider';
import { Modal } from '../../components/Modal';
import { EmptyState, ErrorState, LoadingState } from '../../components/StateViews';
import { Badge, Button, CardLink, PageHeader } from '../../components/ui/Card';
import { ClockIcon, FileTextIcon } from '../../components/ui/Icons';
import type { DifficultyLevel, ExamCategory, QuestionType } from '../../types/api';

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

function CreateExamForm({ onDone }: { onDone: () => void }) {
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

function GenerateExamForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [category, setCategory] = useState<ExamCategory>('THPT');
  const [title, setTitle] = useState('');
  const [durationMinutes, setDurationMinutes] = useState<number | ''>('');
  const [subjectId, setSubjectId] = useState('');
  const [sections, setSections] = useState<GenerateExamSectionPayload[]>([
    { name: 'Tư duy định lượng', subjectId: '', questionCount: 10, maxScore: 50 },
    { name: 'Tư duy định tính', subjectId: '', questionCount: 10, maxScore: 50 },
    { name: 'Khoa học', subjectId: '', questionCount: 10, maxScore: 50 },
  ]);
  const [formError, setFormError] = useState<string | null>(null);

  const subjectsQuery = useQuery({ queryKey: ['subjects'], queryFn: fetchSubjects });
  const structureQuery = useQuery({
    queryKey: ['exam-structure', subjectId],
    queryFn: () => fetchExamStructure(subjectId),
    enabled: category === 'THPT' && !!subjectId,
  });
  const structure = category === 'THPT' ? structureQuery.data : undefined;

  const generateMutation = useMutation({
    mutationFn: () =>
      generateExam(
        category === 'THPT'
          ? {
              title,
              category,
              durationMinutes: durationMinutes === '' ? undefined : durationMinutes,
              subjectId,
            }
          : {
              title,
              category,
              durationMinutes: durationMinutes === '' ? undefined : durationMinutes,
              sections,
            },
      ),
    onSuccess: () => {
      showToast('AI đã ghép đề thi hoàn chỉnh', 'success');
      queryClient.invalidateQueries({ queryKey: ['exams'] });
      onDone();
    },
    onError: (err) => setFormError(getApiErrorMessage(err)),
  });

  function updateSection(index: number, patch: Partial<GenerateExamSectionPayload>) {
    setSections((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    generateMutation.mutate();
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto">
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value as ExamCategory)}
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
      >
        <option value="THPT">Thi tốt nghiệp THPT quốc gia</option>
        <option value="DGNL">Đánh giá năng lực (ĐGNL)</option>
      </select>
      <input
        required
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Tên đề thi"
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
      />
      <input
        type="number"
        min={1}
        value={durationMinutes}
        onChange={(e) => setDurationMinutes(e.target.value === '' ? '' : Number(e.target.value))}
        placeholder={
          structure ? `Thời gian làm bài (phút) — mặc định ${structure.durationMinutes}` : 'Thời gian làm bài (phút)'
        }
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
      />

      {category === 'THPT' ? (
        <>
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

          {subjectId && structureQuery.isLoading && <LoadingState label="Đang tải cấu trúc đề..." />}

          {subjectId && !structureQuery.isLoading && !structure && (
            <ErrorState message="Môn này chưa khai báo cấu trúc đề — vào trang Môn học để cấu hình trước khi ghép đề." />
          )}

          {structure && (
            <div className="rounded-lg border border-slate-200 p-3 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-400">
              <p className="mb-1 font-medium text-slate-700 dark:text-slate-300">
                Đề sẽ ghép theo cấu trúc cố định của môn:
              </p>
              <ul className="list-disc pl-4">
                {structure.items.map((item) => (
                  <li key={item.id}>
                    {TYPE_LABEL[item.type]} · {DIFFICULTY_LABEL[item.difficulty]}: {item.questionCount} câu ×{' '}
                    {item.maxScorePerQuestion}đ
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">3 phần thi, tổng thang điểm 150.</p>
          {sections.map((section, i) => (
            <div key={i} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
              <input
                value={section.name}
                onChange={(e) => updateSection(i, { name: e.target.value })}
                placeholder="Tên phần thi"
                className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
              <select
                required
                value={section.subjectId}
                onChange={(e) => updateSection(i, { subjectId: e.target.value })}
                className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="">Chọn môn học</option>
                {subjectsQuery.data?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-slate-500">
                  Số câu
                  <input
                    type="number"
                    min={1}
                    value={section.questionCount}
                    onChange={(e) => updateSection(i, { questionCount: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                  />
                </label>
                <label className="text-xs text-slate-500">
                  Thang điểm phần này
                  <input
                    type="number"
                    min={0}
                    value={section.maxScore}
                    onChange={(e) => updateSection(i, { maxScore: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      )}

      {formError && <ErrorState message={formError} />}
      <button
        type="submit"
        disabled={generateMutation.isPending || (category === 'THPT' && !structure)}
        className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
      >
        {generateMutation.isPending ? 'Đang ghép đề...' : 'AI ghép đề'}
      </button>
    </form>
  );
}

const CATEGORY_LABEL: Record<ExamCategory, string> = {
  THPT: 'THPT quốc gia',
  DGNL: 'Đánh giá năng lực',
};

export function AdminExamsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);

  const examsQuery = useQuery({ queryKey: ['exams'], queryFn: fetchExams });
  const subjectsQuery = useQuery({ queryKey: ['subjects'], queryFn: fetchSubjects });
  const subjectNameById = new Map(subjectsQuery.data?.map((s) => [s.id, s.name]));

  return (
    <div>
      <PageHeader
        title="Đề thi"
        subtitle="Ghép đề tự động bằng AI hoặc tạo đề rỗng để thêm câu hỏi thủ công"
        icon={<FileTextIcon className="h-5 w-5" />}
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowGenerate(true)}>
              + AI ghép đề
            </Button>
            <Button onClick={() => setShowCreate(true)}>+ Tạo đề thủ công</Button>
          </>
        }
      />

      {examsQuery.isLoading && <LoadingState />}
      {examsQuery.error && <ErrorState message={getApiErrorMessage(examsQuery.error)} />}
      {examsQuery.data && examsQuery.data.length === 0 && <EmptyState label="Chưa có đề thi nào." />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {examsQuery.data?.map((exam) => (
          <Link key={exam.id} to={`/admin/exams/${exam.id}`}>
            <CardLink className="flex h-full flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-slate-900 dark:text-slate-100">{exam.title}</p>
                <Badge variant={exam.category === 'DGNL' ? 'violet' : 'indigo'}>{CATEGORY_LABEL[exam.category]}</Badge>
              </div>
              <div className="mt-auto flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <FileTextIcon className="h-3.5 w-3.5" />
                  {exam.subjectId ? (subjectNameById.get(exam.subjectId) ?? 'Môn học') : 'Nhiều môn'}
                </span>
                <span className="inline-flex items-center gap-1">
                  <ClockIcon className="h-3.5 w-3.5" />
                  {exam.durationMinutes} phút
                </span>
              </div>
            </CardLink>
          </Link>
        ))}
      </div>

      {showCreate && (
        <Modal title="Tạo đề thi thủ công" onClose={() => setShowCreate(false)}>
          <CreateExamForm onDone={() => setShowCreate(false)} />
        </Modal>
      )}

      {showGenerate && (
        <Modal title="AI tự động ghép đề" onClose={() => setShowGenerate(false)}>
          <GenerateExamForm onDone={() => setShowGenerate(false)} />
        </Modal>
      )}
    </div>
  );
}
