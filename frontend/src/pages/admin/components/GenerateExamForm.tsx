import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchExamStructure, fetchSubjects } from '../../../features/subjects/subjectsApi';
import { generateExam, type GenerateExamSectionPayload } from '../../../features/exams/examsApi';
import { fetchDgnlTemplates } from '../../../features/exams/dgnlTemplatesApi';
import { getApiErrorMessage } from '../../../lib/api-client';
import { useToast } from '../../../components/ToastProvider';
import { ErrorState, LoadingState } from '../../../components/StateViews';
import { Button } from '../../../components/ui/Card';
import { XIcon } from '../../../components/ui/Icons';
import type { ExamCategory } from '../../../types/api';
import { DIFFICULTY_LABEL, TYPE_LABEL } from './adminExamsConstants';
import { DgnlTemplateManagerModal } from './DgnlTemplateManagerModal';

export function GenerateExamForm({ onDone }: { onDone: () => void }) {
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

  function addSection() {
    setSections((prev) => [...prev, { name: '', subjectId: '', questionCount: 10, maxScore: 10 }]);
  }

  function removeSection(index: number) {
    setSections((prev) => prev.filter((_, i) => i !== index));
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
              <p className="text-xs text-slate-500">Khai báo tự do số phần thi, tổng thang điểm nên bằng 150.</p>
              {sections.map((section, i) => (
                <div key={i} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                  <div className="mb-2 flex items-center gap-2">
                    <input
                      value={section.name}
                      onChange={(e) => updateSection(i, { name: e.target.value })}
                      placeholder="Tên phần thi"
                      className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => removeSection(i)}
                      disabled={sections.length <= 1}
                      title="Xoá phần thi này"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-slate-400 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:border-slate-700 dark:hover:border-red-900 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                    >
                      <XIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
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
              <Button type="button" variant="secondary" onClick={addSection}>
                + Thêm phần thi
              </Button>
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
