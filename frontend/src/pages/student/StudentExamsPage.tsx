import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { fetchExams } from '../../features/exams/examsApi';
import { fetchSubjects } from '../../features/subjects/subjectsApi';
import { getApiErrorMessage } from '../../lib/api-client';
import { EmptyState, ErrorState, LoadingState } from '../../components/StateViews';

export function StudentExamsPage() {
  const navigate = useNavigate();
  const examsQuery = useQuery({ queryKey: ['exams'], queryFn: fetchExams });
  const subjectsQuery = useQuery({ queryKey: ['subjects'], queryFn: fetchSubjects });

  const subjectNameById = new Map(subjectsQuery.data?.map((s) => [s.id, s.name]));

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-900 dark:text-slate-100">Đề thi được phép làm</h1>
      {examsQuery.isLoading && <LoadingState />}
      {examsQuery.error && <ErrorState message={getApiErrorMessage(examsQuery.error)} />}
      {examsQuery.data && examsQuery.data.length === 0 && (
        <EmptyState label="Chưa có đề thi nào khả dụng cho bạn." />
      )}
      <div className="space-y-3">
        {examsQuery.data?.map((exam) => (
          <div
            key={exam.id}
            className="flex items-center justify-between rounded-lg border border-slate-200 p-4 dark:border-slate-800"
          >
            <div>
              <p className="font-medium text-slate-900 dark:text-slate-100">{exam.title}</p>
              <p className="text-xs text-slate-500">
                {subjectNameById.get(exam.subjectId) ?? 'Môn học'} · {exam.durationMinutes} phút
                {exam.tenantId === null && ' · Đề chính thức'}
              </p>
            </div>
            <button
              onClick={() => navigate(`/student/exams/${exam.id}/attempt`)}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-slate-900"
            >
              Làm bài
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
