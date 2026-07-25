import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMyReadiness } from '../features/readiness/readinessApi';
import { Card } from './ui/Card';
import { SparklesIcon, TargetIcon } from './ui/Icons';
import { LoadingState } from './StateViews';

const BREAKDOWN_LABEL: Record<string, string> = {
  score: 'Điểm số gần đây',
  coverage: 'Độ phủ chuyên đề',
  mastery: 'Mức độ thành thạo',
  consistency: 'Tính đều đặn',
};

function scoreColor(value: number) {
  if (value >= 70) return { ring: '#10b981', text: 'text-emerald-600 dark:text-emerald-400' };
  if (value >= 40) return { ring: '#f59e0b', text: 'text-amber-600 dark:text-amber-400' };
  return { ring: '#ef4444', text: 'text-red-600 dark:text-red-400' };
}

// Vòng tròn tiến độ vẽ tay bằng SVG (stroke-dasharray) — không cần thêm thư
// viện chart mới chỉ để vẽ một gauge đơn.
function ReadinessGauge({ value }: { value: number }) {
  const { ring } = scoreColor(value);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - value / 100);

  return (
    <div className="relative flex h-32 w-32 shrink-0 items-center justify-center">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={radius} fill="none" strokeWidth="10" className="stroke-slate-100 dark:stroke-slate-800" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          stroke={ring}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">{value}</span>
        <span className="text-[11px] text-slate-400">/ 100</span>
      </div>
    </div>
  );
}

function BreakdownBar({ label, value }: { label: string; value: number }) {
  const { ring } = scoreColor(value);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-slate-500 dark:text-slate-400">{label}</span>
        <span className="font-medium text-slate-700 dark:text-slate-300">{value}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${value}%`, backgroundColor: ring }}
        />
      </div>
    </div>
  );
}

export function ReadinessCard({ subjectNameById }: { subjectNameById: Map<string, string> }) {
  const readinessQuery = useQuery({ queryKey: ['my-readiness'], queryFn: fetchMyReadiness });
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);

  if (readinessQuery.isLoading) return <LoadingState label="Đang tính điểm sẵn sàng thi..." />;
  if (!readinessQuery.data || readinessQuery.data.subjects.length === 0) return null;

  const { subjects } = readinessQuery.data;
  const active = subjects.find((s) => s.subjectId === selectedSubjectId) ?? subjects[0];

  return (
    <div className="mb-10">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
        <TargetIcon className="h-5 w-5 text-indigo-500" />
        Điểm sẵn sàng thi
      </h2>

      {subjects.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {subjects.map((s) => (
            <button
              key={s.subjectId}
              onClick={() => setSelectedSubjectId(s.subjectId)}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                s.subjectId === active.subjectId
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {subjectNameById.get(s.subjectId) ?? 'Môn học'}
            </button>
          ))}
        </div>
      )}

      <Card className="p-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <ReadinessGauge value={active.readinessScore} />
          <div className="flex-1">
            <p className="font-semibold text-slate-900 dark:text-slate-100">
              {subjectNameById.get(active.subjectId) ?? 'Môn học'}
            </p>
            {active.predictedScoreRange && (
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                Dự đoán điểm thi (thang 10):{' '}
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {active.predictedScoreRange.low} – {active.predictedScoreRange.high}
                </span>
              </p>
            )}
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-indigo-50/60 p-2.5 text-xs text-slate-600 dark:bg-indigo-500/5 dark:text-slate-400">
              <SparklesIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500" />
              {active.aiNote}
            </p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(Object.entries(active.breakdown) as Array<[string, number]>).map(([key, value]) => (
            <BreakdownBar key={key} label={BREAKDOWN_LABEL[key] ?? key} value={value} />
          ))}
        </div>
      </Card>
    </div>
  );
}
