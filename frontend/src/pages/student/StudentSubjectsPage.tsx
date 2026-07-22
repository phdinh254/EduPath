import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchSubjects, fetchTopics } from '../../features/subjects/subjectsApi';
import { getApiErrorMessage } from '../../lib/api-client';
import { EmptyState, ErrorState, LoadingState } from '../../components/StateViews';
import { Card, PageHeader } from '../../components/ui/Card';
import { BookIcon, ChevronDownIcon, LayersIcon } from '../../components/ui/Icons';

function TopicsList({ subjectId }: { subjectId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['topics', subjectId],
    queryFn: () => fetchTopics(subjectId),
  });

  if (isLoading) return <LoadingState label="Đang tải chuyên đề..." />;
  if (error) return <ErrorState message={getApiErrorMessage(error)} />;
  if (!data || data.length === 0) return <EmptyState label="Chưa có chuyên đề nào." />;

  return (
    <div className="flex flex-wrap gap-2">
      {data.map((topic) => (
        <span
          key={topic.id}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-50 px-3 py-1.5 text-sm text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
        >
          <LayersIcon className="h-3.5 w-3.5" />
          {topic.name}
        </span>
      ))}
    </div>
  );
}

const CARD_ACCENTS = [
  'from-indigo-500 to-violet-600',
  'from-sky-500 to-blue-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
];

export function StudentSubjectsPage() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const { data, isLoading, error } = useQuery({ queryKey: ['subjects'], queryFn: fetchSubjects });

  return (
    <div>
      <PageHeader
        title="Môn học & chuyên đề"
        subtitle="Chọn một môn học để xem các chuyên đề đang có sẵn để ôn luyện"
        icon={<BookIcon className="h-5 w-5" />}
      />

      {isLoading && <LoadingState />}
      {error && <ErrorState message={getApiErrorMessage(error)} />}
      {data && data.length === 0 && <EmptyState label="Chưa có môn học nào trong hệ thống." />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {data?.map((subject, i) => {
          const isOpen = expanded === subject.id;
          return (
            <Card key={subject.id} className="overflow-hidden p-0">
              <button
                onClick={() => setExpanded(isOpen ? null : subject.id)}
                className="flex w-full items-center gap-4 p-5 text-left"
              >
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-md ${CARD_ACCENTS[i % CARD_ACCENTS.length]}`}
                >
                  <BookIcon className="h-5 w-5" />
                </span>
                <div className="flex-1">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{subject.name}</p>
                  <p className="text-xs text-slate-400">{subject.code}</p>
                </div>
                <ChevronDownIcon
                  className={`h-5 w-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {isOpen && (
                <div className="border-t border-slate-100 px-5 py-4 dark:border-slate-800">
                  <TopicsList subjectId={subject.id} />
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
