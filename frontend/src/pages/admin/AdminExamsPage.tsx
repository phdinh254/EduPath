import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchSubjects } from '../../features/subjects/subjectsApi';
import { fetchExams } from '../../features/exams/examsApi';
import { getApiErrorMessage } from '../../lib/api-client';
import { Modal } from '../../components/Modal';
import { EmptyState, ErrorState, LoadingState } from '../../components/StateViews';
import { Badge, Button, CardLink, PageHeader } from '../../components/ui/Card';
import { ClockIcon, FileTextIcon } from '../../components/ui/Icons';
import { CreateExamForm } from './components/CreateExamForm';
import { GenerateExamForm } from './components/GenerateExamForm';
import { CATEGORY_LABEL, STATUS_BADGE } from './components/adminExamsConstants';

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
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge variant={exam.category === 'DGNL' ? 'violet' : 'indigo'}>{CATEGORY_LABEL[exam.category]}</Badge>
                  <Badge variant={STATUS_BADGE[exam.status].variant}>{STATUS_BADGE[exam.status].label}</Badge>
                </div>
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
