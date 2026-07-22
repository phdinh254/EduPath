import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { fetchExams } from '../../features/exams/examsApi';
import { fetchSubjects } from '../../features/subjects/subjectsApi';
import { getApiErrorMessage } from '../../lib/api-client';
import { EmptyState, ErrorState, LoadingState } from '../../components/StateViews';
import { Badge, Button, CardLink, PageHeader } from '../../components/ui/Card';
import { ClockIcon, FileTextIcon } from '../../components/ui/Icons';
import type { ExamCategory } from '../../types/api';

const CATEGORY_LABEL: Record<ExamCategory, string> = {
  THPT: 'THPT quốc gia',
  DGNL: 'Đánh giá năng lực',
};

export function StudentExamsPage() {
  const navigate = useNavigate();
  const examsQuery = useQuery({ queryKey: ['exams'], queryFn: fetchExams });
  const subjectsQuery = useQuery({ queryKey: ['subjects'], queryFn: fetchSubjects });

  const subjectNameById = new Map(subjectsQuery.data?.map((s) => [s.id, s.name]));

  return (
    <div>
      <PageHeader
        title="Đề thi được phép làm"
        subtitle="Chọn một đề để bắt đầu — kết quả và giải thích được trả về ngay sau khi nộp bài"
        icon={<FileTextIcon className="h-5 w-5" />}
      />

      {examsQuery.isLoading && <LoadingState />}
      {examsQuery.error && <ErrorState message={getApiErrorMessage(examsQuery.error)} />}
      {examsQuery.data && examsQuery.data.length === 0 && (
        <EmptyState label="Chưa có đề thi nào khả dụng cho bạn." />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {examsQuery.data?.map((exam) => (
          <CardLink key={exam.id} className="flex flex-col gap-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold text-slate-900 dark:text-slate-100">{exam.title}</p>
              <Badge variant={exam.category === 'DGNL' ? 'violet' : 'indigo'}>{CATEGORY_LABEL[exam.category]}</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1">
                <FileTextIcon className="h-3.5 w-3.5" />
                {exam.subjectId ? (subjectNameById.get(exam.subjectId) ?? 'Môn học') : 'Nhiều môn'}
              </span>
              <span className="inline-flex items-center gap-1">
                <ClockIcon className="h-3.5 w-3.5" />
                {exam.durationMinutes} phút
              </span>
            </div>
            <Button onClick={() => navigate(`/student/exams/${exam.id}/attempt`)} className="mt-auto w-full">
              Làm bài ngay
            </Button>
          </CardLink>
        ))}
      </div>
    </div>
  );
}
