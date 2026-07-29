import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSubjects } from '../../../features/subjects/subjectsApi';
import {
  createDgnlTemplate,
  deleteDgnlTemplate,
  fetchDgnlTemplates,
  type DgnlTemplateSectionPayload,
} from '../../../features/exams/dgnlTemplatesApi';
import { getApiErrorMessage } from '../../../lib/api-client';
import { useToast } from '../../../components/ToastProvider';
import { Modal } from '../../../components/Modal';
import { EmptyState, ErrorState, LoadingState } from '../../../components/StateViews';
import { Button } from '../../../components/ui/Card';
import { XIcon } from '../../../components/ui/Icons';

export function DgnlTemplateManagerModal({ onClose }: { onClose: () => void }) {
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

  function addSection() {
    setSections((prev) => [...prev, { name: '', subjectId: '', questionCount: 10, maxScore: 10 }]);
  }

  function removeSection(index: number) {
    setSections((prev) => prev.filter((_, i) => i !== index));
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
