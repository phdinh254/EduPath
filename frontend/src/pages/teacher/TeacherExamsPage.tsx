import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchSubjects } from '../../features/subjects/subjectsApi';
import { fetchMyClasses } from '../../features/classes/classesApi';
import { createExam, fetchExams } from '../../features/exams/examsApi';
import { getApiErrorMessage } from '../../lib/api-client';
import { useToast } from '../../components/ToastProvider';
import { Modal } from '../../components/Modal';
import { EmptyState, ErrorState, LoadingState } from '../../components/StateViews';

export function TeacherExamsPage() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [classId, setClassId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const examsQuery = useQuery({ queryKey: ['exams'], queryFn: fetchExams });
  const subjectsQuery = useQuery({ queryKey: ['subjects'], queryFn: fetchSubjects });
  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: fetchMyClasses });
  const subjectNameById = new Map(subjectsQuery.data?.map((s) => [s.id, s.name]));

  const createMutation = useMutation({
    mutationFn: () => createExam({ title, subjectId, durationMinutes, classId: classId || undefined }),
    onSuccess: () => {
      showToast('Tạo đề thi thành công', 'success');
      setShowCreate(false);
      setTitle('');
      queryClient.invalidateQueries({ queryKey: ['exams'] });
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
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Đề thi</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-slate-900"
        >
          + Tạo đề thi
        </button>
      </div>

      {examsQuery.isLoading && <LoadingState />}
      {examsQuery.error && <ErrorState message={getApiErrorMessage(examsQuery.error)} />}
      {examsQuery.data && examsQuery.data.length === 0 && <EmptyState label="Chưa có đề thi nào." />}

      <div className="space-y-3">
        {examsQuery.data?.map((exam) => (
          <Link
            key={exam.id}
            to={`/teacher/exams/${exam.id}`}
            className="block rounded-lg border border-slate-200 p-4 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
          >
            <p className="font-medium text-slate-900 dark:text-slate-100">{exam.title}</p>
            <p className="text-xs text-slate-500">
              {subjectNameById.get(exam.subjectId) ?? 'Môn học'} · {exam.durationMinutes} phút
            </p>
          </Link>
        ))}
      </div>

      {showCreate && (
        <Modal title="Tạo đề thi mới" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="">Không gán lớp (đề dùng chung)</option>
              {classesQuery.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {formError && <ErrorState message={formError} />}
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
            >
              {createMutation.isPending ? 'Đang tạo...' : 'Tạo đề thi'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
