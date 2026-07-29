import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fetchMyAttempts } from '../../../features/exams/examsApi';
import { getApiErrorMessage } from '../../../lib/api-client';
import { ErrorState, LoadingState } from '../../../components/StateViews';
import { Card } from '../../../components/ui/Card';
import { StatCard } from '../../../components/ui/StatCard';
import { ChartIcon, ClipboardCheckIcon, StarIcon } from '../../../components/ui/Icons';
import { MAX_SCORE_BY_CATEGORY } from './roadmapConstants';

// Biểu đồ xu hướng điểm số + 3 stat tile tổng quan — tách khỏi
// StudentRoadmapPage vì kéo theo thư viện recharts khá nặng, để lazy-load
// route vẫn tách được thành chunk riêng thay vì gộp vào toàn bộ trang.
export function ProgressDashboard() {
  const attemptsQuery = useQuery({ queryKey: ['my-attempts'], queryFn: fetchMyAttempts });

  const gradedAttempts = useMemo(
    () =>
      (attemptsQuery.data ?? [])
        .filter((a) => a.status === 'GRADED' && a.totalScore != null && a.exam)
        .map((a, i) => {
          const maxScore = MAX_SCORE_BY_CATEGORY[a.exam!.category];
          const percent = Math.round(((a.totalScore ?? 0) / maxScore) * 1000) / 10;
          return {
            index: i + 1,
            title: a.exam!.title,
            percent,
            date: new Date(a.submittedAt ?? a.createdAt).toLocaleDateString('vi-VN'),
          };
        }),
    [attemptsQuery.data],
  );

  if (attemptsQuery.isLoading) return <LoadingState label="Đang tải tiến độ ôn tập..." />;
  if (attemptsQuery.error) return <ErrorState message={getApiErrorMessage(attemptsQuery.error)} />;
  if (gradedAttempts.length === 0) return null;

  const avgPercent = Math.round((gradedAttempts.reduce((s, a) => s + a.percent, 0) / gradedAttempts.length) * 10) / 10;
  const last = gradedAttempts[gradedAttempts.length - 1];
  const prev = gradedAttempts.length > 1 ? gradedAttempts[gradedAttempts.length - 2] : null;
  const trend = prev ? Math.round((last.percent - prev.percent) * 10) / 10 : null;

  return (
    <div className="mb-10">
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Đề đã làm" value={gradedAttempts.length} icon={<ClipboardCheckIcon className="h-6 w-6" />} accent="indigo" />
        <StatCard label="Điểm trung bình" value={`${avgPercent}%`} icon={<ChartIcon className="h-6 w-6" />} accent="emerald" />
        <StatCard
          label="So với lần trước"
          value={trend == null ? '—' : `${trend > 0 ? '+' : ''}${trend}%`}
          icon={<StarIcon className="h-6 w-6" />}
          accent={trend == null || trend >= 0 ? 'sky' : 'red'}
        />
      </div>
      <Card className="p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">Xu hướng điểm số theo thời gian</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={gradedAttempts} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
              <XAxis dataKey="index" tick={{ fontSize: 12 }} stroke="currentColor" className="text-slate-500" />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 12 }}
                stroke="currentColor"
                className="text-slate-500"
                unit="%"
              />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }}
                formatter={(value) => [`${value}%`, 'Điểm']}
                labelFormatter={(index) => gradedAttempts[Number(index) - 1]?.title ?? ''}
              />
              <Line type="monotone" dataKey="percent" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
