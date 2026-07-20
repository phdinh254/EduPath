import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchSubjects, fetchTopics } from '../../features/subjects/subjectsApi';
import { getApiErrorMessage } from '../../lib/api-client';
import { EmptyState, ErrorState, LoadingState } from '../../components/StateViews';

function TopicsList({ subjectId }: { subjectId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['topics', subjectId],
    queryFn: () => fetchTopics(subjectId),
  });

  if (isLoading) return <LoadingState label="Đang tải chuyên đề..." />;
  if (error) return <ErrorState message={getApiErrorMessage(error)} />;
  if (!data || data.length === 0) return <EmptyState label="Chưa có chuyên đề nào." />;

  return (
    <ul className="ml-4 list-disc space-y-1 text-sm text-slate-600 dark:text-slate-400">
      {data.map((topic) => (
        <li key={topic.id}>{topic.name}</li>
      ))}
    </ul>
  );
}

export function StudentSubjectsPage() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const { data, isLoading, error } = useQuery({ queryKey: ['subjects'], queryFn: fetchSubjects });

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-900 dark:text-slate-100">Môn học &amp; chuyên đề</h1>
      {isLoading && <LoadingState />}
      {error && <ErrorState message={getApiErrorMessage(error)} />}
      {data && data.length === 0 && <EmptyState label="Chưa có môn học nào trong hệ thống." />}
      <div className="space-y-3">
        {data?.map((subject) => (
          <div key={subject.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
            <button
              onClick={() => setExpanded(expanded === subject.id ? null : subject.id)}
              className="flex w-full items-center justify-between text-left font-medium text-slate-900 dark:text-slate-100"
            >
              {subject.name}
              <span className="text-slate-400">{expanded === subject.id ? '−' : '+'}</span>
            </button>
            {expanded === subject.id && (
              <div className="mt-3">
                <TopicsList subjectId={subject.id} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
