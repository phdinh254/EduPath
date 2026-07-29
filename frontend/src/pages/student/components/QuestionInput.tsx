import type { ExamQuestion } from '../../../types/api';

// Renderer đầu vào câu trả lời theo từng dạng câu hỏi — tách khỏi
// StudentExamAttemptPage vì đây là khối UI thuần, không phụ thuộc state của trang.
export function QuestionInput({
  examQuestion,
  value,
  onChange,
}: {
  examQuestion: ExamQuestion;
  value: unknown;
  onChange: (response: unknown) => void;
}) {
  const { question } = examQuestion;

  if (question.type === 'MULTIPLE_CHOICE') {
    const options = (question.options as string[] | null) ?? [];
    const selected = (value as { index?: number } | null)?.index;
    return (
      <div className="space-y-2">
        {options.map((option, index) => (
          <label
            key={index}
            className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm transition ${
              selected === index
                ? 'border-indigo-400 bg-indigo-50 text-indigo-800 dark:border-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-200'
                : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800/60'
            }`}
          >
            <input
              type="radio"
              className="accent-indigo-600"
              checked={selected === index}
              onChange={() => onChange({ index })}
              name={`q-${examQuestion.questionId}`}
            />
            {option}
          </label>
        ))}
      </div>
    );
  }

  if (question.type === 'TRUE_FALSE') {
    const statements = (value as { statements?: boolean[] } | null)?.statements ?? [false, false, false, false];
    return (
      <div className="space-y-2">
        {statements.map((checked, index) => (
          <label
            key={index}
            className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm transition ${
              checked
                ? 'border-indigo-400 bg-indigo-50 text-indigo-800 dark:border-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-200'
                : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800/60'
            }`}
          >
            <input
              type="checkbox"
              className="accent-indigo-600"
              checked={checked}
              onChange={(e) => {
                const next = [...statements];
                next[index] = e.target.checked;
                onChange({ statements: next });
              }}
            />
            Ý {String.fromCharCode(97 + index)}
          </label>
        ))}
      </div>
    );
  }

  if (question.type === 'SHORT_ANSWER') {
    return (
      <input
        defaultValue={(value as { value?: string } | null)?.value ?? ''}
        onBlur={(e) => onChange({ value: e.target.value })}
        className="w-full max-w-sm rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:focus:ring-indigo-500/20"
        placeholder="Nhập câu trả lời ngắn"
      />
    );
  }

  // ESSAY
  return (
    <textarea
      defaultValue={(value as { text?: string } | null)?.text ?? ''}
      onBlur={(e) => onChange({ text: e.target.value })}
      rows={8}
      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:focus:ring-indigo-500/20"
      placeholder="Viết bài làm của bạn ở đây"
    />
  );
}
