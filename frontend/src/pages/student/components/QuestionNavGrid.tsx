import { StarIcon } from '../../../components/ui/Icons';
import type { ExamQuestion, ExamSection } from '../../../types/api';

function QuestionNavButton({
  index,
  isCurrent,
  isAnswered,
  isStarred,
  onClick,
}: {
  index: number;
  isCurrent: boolean;
  isAnswered: boolean;
  isStarred: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex h-9 w-9 items-center justify-center rounded-xl text-sm font-medium transition ${
        isCurrent
          ? 'bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-sm'
          : isAnswered
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
      }`}
    >
      {index + 1}
      {isStarred && <StarIcon className="absolute -right-1 -top-1 h-3 w-3 fill-amber-500 text-amber-500" />}
    </button>
  );
}

interface QuestionNavGridProps {
  questions: ExamQuestion[];
  sections: ExamSection[];
  currentIndex: number;
  answers: Record<string, unknown>;
  starred: Set<string>;
  onSelect: (index: number) => void;
}

// Lưới điều hướng câu hỏi — gộp theo phần thi nếu đề có nhiều phần (ĐGNL).
export function QuestionNavGrid({
  questions,
  sections,
  currentIndex,
  answers,
  starred,
  onSelect,
}: QuestionNavGridProps) {
  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Danh sách câu hỏi</p>
      {sections.length > 1 ? (
        <div className="space-y-4">
          {sections.map((section) => {
            const items = questions
              .map((eq, index) => ({ eq, index }))
              .filter(({ eq }) => eq.sectionId === section.id);
            if (items.length === 0) return null;
            return (
              <div key={section.id}>
                <p className="mb-2 text-xs font-semibold text-violet-700 dark:text-violet-300">{section.name}</p>
                <div className="flex flex-wrap gap-2">
                  {items.map(({ eq, index }) => (
                    <QuestionNavButton
                      key={eq.id}
                      index={index}
                      isCurrent={index === currentIndex}
                      isAnswered={answers[eq.questionId] != null}
                      isStarred={starred.has(eq.questionId)}
                      onClick={() => onSelect(index)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {questions.map((eq, index) => (
            <QuestionNavButton
              key={eq.id}
              index={index}
              isCurrent={index === currentIndex}
              isAnswered={answers[eq.questionId] != null}
              isStarred={starred.has(eq.questionId)}
              onClick={() => onSelect(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
