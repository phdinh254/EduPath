import { Button } from './ui/Card';

interface PaginationProps {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
}

// Điều khiển phân trang tối giản (Trước/Sau + "Trang X/Y") dùng chung cho mọi
// danh sách lớn có phân trang phía backend (đề thi, câu hỏi, người dùng, audit log).
export function Pagination({ page, limit, total, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  if (totalPages <= 1) return null;

  return (
    <div className="mt-4 flex items-center justify-between gap-3 text-sm">
      <span className="text-slate-500 dark:text-slate-400">
        Trang {page}/{totalPages} · {total} kết quả
      </span>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          className="px-3 py-1.5 text-xs"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          ← Trước
        </Button>
        <Button
          variant="secondary"
          className="px-3 py-1.5 text-xs"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Sau →
        </Button>
      </div>
    </div>
  );
}
