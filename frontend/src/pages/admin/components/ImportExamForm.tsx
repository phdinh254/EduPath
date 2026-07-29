import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSubjects, fetchTopics } from '../../../features/subjects/subjectsApi';
import {
  commitImportedQuestions,
  parseExamImport,
  type ParsedImportQuestion,
} from '../../../features/questions/questionsApi';
import { getApiErrorMessage } from '../../../lib/api-client';
import { useToast } from '../../../components/ToastProvider';
import { ErrorState } from '../../../components/StateViews';
import type { DifficultyLevel } from '../../../types/api';
import { TYPE_LABEL } from './adminQuestionsConstants';

// Nháp một câu hỏi đã tách — thêm topicId (khớp tự động theo tên chuyên đề
// gợi ý, hoặc để trống để ADMIN tự chọn) và include (bỏ chọn để loại câu này
// khỏi lần nhập, vd. AI tách nhầm/không cần thiết) so với dữ liệu AI trả về.
interface DraftQuestion extends ParsedImportQuestion {
  topicId: string;
  include: boolean;
}

export function ImportExamForm({ onDone }: { onDone: () => void }) {
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
