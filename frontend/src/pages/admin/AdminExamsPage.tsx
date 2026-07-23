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
import {
  createDgnlTemplate,
  deleteDgnlTemplate,
  fetchDgnlTemplates,
  type DgnlTemplateSectionPayload,
} from '../../features/exams/dgnlTemplatesApi';
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

function DgnlTemplateManagerModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [sections, setSections] = useState<DgnlTemplateSectionPayload[]>([
    { name: 'Tư duy định lượng', subjectId: '', questionCount: 10, maxScore: 50 },
    { name: 'Tư duy định tính', subjectId: '', questionCount: 10, maxScore: 50 },
    { name: 'Khoa học', subjectId: '', questionCount: 10, maxScore: 50 },
  ]);
  const [formError, setFormError] = useState<string | null>(null);

  const templatesQuery = useQuery({ queryKey: ['dgnl-templates'], queryFn: fetchDgnlTemplates });
  const subjectsQuery = useQuery({ queryKey: ['subjects'], queryFn: fetchSubjects });
  const subjectNameById = new Map(subjectsQuery.data?.map((s) => [s.id, s.name]));

  const createMutation = useMutation({
    mutationFn: () => createDgnlTemplate({ name, sections }),
    onSuccess: () => {
      showToast('Đã tạo mẫu đề ĐGNL', 'success');
      setShowCreate(false);
      setName('');
      queryClient.invalidateQueries({ queryKey: ['dgnl-templates'] });
    },
    onError: (err) => setFormError(getApiErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDgnlTemplate(id),
    onSuccess: () => {
      showToast('Đã xoá mẫu đề ĐGNL', 'success');
      queryClient.invalidateQueries({ queryKey: ['dgnl-templates'] });
    },
    onError: (err) => showToast(getApiErrorMessage(err), 'error'),
  });

  function updateSection(index: number, patch: Partial<DgnlTemplateSectionPayload>) {
    setSections((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    createMutation.mutate();
  }

  const totalScore = sections.reduce((sum, s) => sum + s.maxScore, 0);

  return (
    <Modal title="Mẫu đề ĐGNL dùng chung" onClose={onClose}>
      <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
        {templatesQuery.isLoading && <LoadingState label="Đang tải mẫu đề..." />}
        {templatesQuery.data && templatesQuery.data.length === 0 && !showCreate && (
          <EmptyState label="Chưa có mẫu đề ĐGNL nào." />
        )}
        {templatesQuery.data && templatesQuery.data.length > 0 && (
          <div className="space-y-2">
            {templatesQuery.data.map((t) => (
              <div key={t.id} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
                <div className="mb-1 flex items-center justify-between">
                  <p className="font-medium text-slate-900 dark:text-slate-100">{t.name}</p>
                  <button
                    onClick={() => deleteMutation.mutate(t.id)}
                    disabled={deleteMutation.isPending}
                    className="text-xs text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
                  >
                    Xoá
                  </button>
                </div>
                <ul className="text-xs text-slate-500 dark:text-slate-400">
                  {t.sections.map((s) => (
                    <li key={s.id}>
                      {s.name} · {subjectNameById.get(s.subjectId) ?? 'Môn học'} · {s.questionCount} câu ×{' '}
                      {(s.maxScore / s.questionCount).toFixed(2)}đ = {s.maxScore}đ
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {!showCreate ? (
          <Button variant="secondary" onClick={() => setShowCreate(true)}>
            + Tạo mẫu mới
          </Button>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tên mẫu (vd: ĐGNL chuẩn 2025)"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
            <p className="text-xs text-slate-500">Tổng thang điểm phải bằng 150 (hiện tại: {totalScore}).</p>
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
            {formError && <ErrorState message={formError} />}
            <div className="flex gap-2">
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Đang lưu...' : 'Lưu mẫu'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>
                Huỷ
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}

function GenerateExamForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [category, setCategory] = useState<ExamCategory>('THPT');
  const [title, setTitle] = useState('');
  const [durationMinutes, setDurationMinutes] = useState<number | ''>('');
  const [subjectId, setSubjectId] = useState('');
  const [dgnlMode, setDgnlMode] = useState<'template' | 'manual'>('template');
  const [templateId, setTemplateId] = useState('');
  const [showTemplateManager, setShowTemplateManager] = useState(false);
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
  const templatesQuery = useQuery({
    queryKey: ['dgnl-templates'],
    queryFn: fetchDgnlTemplates,
    enabled: category === 'DGNL',
  });
  const selectedTemplate = templatesQuery.data?.find((t) => t.id === templateId);
  const subjectNameById = new Map(subjectsQuery.data?.map((s) => [s.id, s.name]));

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
          : dgnlMode === 'template'
            ? {
                title,
                category,
                durationMinutes: durationMinutes === '' ? undefined : durationMinutes,
                dgnlTemplateId: templateId,
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
    <>
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
          <div className="flex gap-2 text-sm">
            <button
              type="button"
              onClick={() => setDgnlMode('template')}
              className={`flex-1 rounded-lg border px-3 py-1.5 ${
                dgnlMode === 'template'
                  ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                  : 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-400'
              }`}
            >
              Dùng mẫu có sẵn
            </button>
            <button
              type="button"
              onClick={() => setDgnlMode('manual')}
              className={`flex-1 rounded-lg border px-3 py-1.5 ${
                dgnlMode === 'manual'
                  ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                  : 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-400'
              }`}
            >
              Tự nhập thủ công
            </button>
          </div>

          {dgnlMode === 'template' ? (
            <>
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="">Chọn mẫu đề ĐGNL</option>
                {templatesQuery.data?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              {templatesQuery.data && templatesQuery.data.length === 0 && (
                <ErrorState message="Chưa có mẫu đề ĐGNL nào — bấm 'Quản lý mẫu ĐGNL' để tạo trước." />
              )}
              {selectedTemplate && (
                <div className="rounded-lg border border-slate-200 p-3 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-400">
                  <ul className="list-disc pl-4">
                    {selectedTemplate.sections.map((s) => (
                      <li key={s.id}>
                        {s.name} · {subjectNameById.get(s.subjectId) ?? 'Môn học'} · {s.questionCount} câu ={' '}
                        {s.maxScore}đ
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <button
                type="button"
                onClick={() => setShowTemplateManager(true)}
                className="text-xs font-medium text-slate-600 hover:underline dark:text-slate-400"
              >
                Quản lý mẫu ĐGNL
              </button>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      )}

      {formError && <ErrorState message={formError} />}
      <button
        type="submit"
        disabled={
          generateMutation.isPending ||
          (category === 'THPT' && !structure) ||
          (category === 'DGNL' && dgnlMode === 'template' && !templateId)
        }
        className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
      >
        {generateMutation.isPending ? 'Đang ghép đề...' : 'AI ghép đề'}
      </button>
    </form>

    {showTemplateManager && (
      <DgnlTemplateManagerModal onClose={() => setShowTemplateManager(false)} />
    )}
    </>
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
