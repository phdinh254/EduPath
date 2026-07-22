import type { ReactNode } from 'react';

const ACCENTS = {
  indigo: 'from-indigo-500 to-violet-600 shadow-indigo-500/30',
  emerald: 'from-emerald-500 to-teal-600 shadow-emerald-500/30',
  amber: 'from-amber-500 to-orange-600 shadow-amber-500/30',
  red: 'from-rose-500 to-red-600 shadow-rose-500/30',
  sky: 'from-sky-500 to-blue-600 shadow-sky-500/30',
} as const;

export function StatCard({
  label,
  value,
  icon,
  accent = 'indigo',
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
  accent?: keyof typeof ACCENTS;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
      <div className="flex items-center gap-4">
        <span
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-md ${ACCENTS[accent]}`}
        >
          {icon}
        </span>
        <div>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-50">{value}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
        </div>
      </div>
    </div>
  );
}
