export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export interface SkipTake {
  skip: number;
  take: number;
  page: number;
  limit: number;
}

// Chuẩn hoá page/limit (đến từ query string, đã qua PaginationQueryDto validate
// kiểu số nhưng chưa chắc trong khoảng hợp lệ) thành skip/take an toàn cho Prisma.
export function toSkipTake(page?: number, limit?: number): SkipTake {
  const safePage = Math.max(1, page ?? DEFAULT_PAGE);
  const safeLimit = Math.min(MAX_LIMIT, Math.max(1, limit ?? DEFAULT_LIMIT));
  return {
    skip: (safePage - 1) * safeLimit,
    take: safeLimit,
    page: safePage,
    limit: safeLimit,
  };
}

export function toPaginatedResult<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResult<T> {
  return { data, total, page, limit };
}
