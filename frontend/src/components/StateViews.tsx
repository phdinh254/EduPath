export function LoadingState({ label = 'Đang tải dữ liệu...' }: { label?: string }) {
  return <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">{label}</p>;
}

export function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
      {label}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
      {message}
    </div>
  );
}
