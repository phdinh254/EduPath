import { useState } from 'react';

const KEYS = ['7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', '0', '.', '=', '+'];

// Chỉ chấp nhận chữ số và +-*/. — không eval chuỗi người dùng gõ tự do, an toàn
// vì biểu thức chỉ được ghép từ các phím bấm cố định ở trên.
function safeEvaluate(expr: string): string {
  if (!/^[0-9+\-*/.\s]+$/.test(expr)) return 'Lỗi';
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    const result = new Function(`return (${expr})`)() as number;
    if (!Number.isFinite(result)) return 'Lỗi';
    return String(Math.round(result * 1e10) / 1e10);
  } catch {
    return 'Lỗi';
  }
}

export function Calculator({ onClose }: { onClose: () => void }) {
  const [expr, setExpr] = useState('');

  function press(key: string) {
    if (key === '=') {
      setExpr((prev) => (prev ? safeEvaluate(prev) : prev));
    } else {
      setExpr((prev) => (prev === 'Lỗi' ? key : prev + key));
    }
  }

  return (
    <div className="w-64 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Máy tính</p>
        <button
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          ✕
        </button>
      </div>
      <div className="mb-3 flex items-center justify-between rounded-xl bg-slate-100 px-3 py-3 text-right font-mono text-lg text-slate-900 dark:bg-slate-800 dark:text-slate-100">
        <button
          onClick={() => setExpr('')}
          className="text-xs font-sans text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
        >
          C
        </button>
        <span className="truncate">{expr || '0'}</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {KEYS.map((key) => (
          <button
            key={key}
            onClick={() => press(key)}
            className={`rounded-xl py-2 text-sm font-medium transition ${
              key === '='
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {key}
          </button>
        ))}
      </div>
    </div>
  );
}
