// Suy ra một database Postgres RIÊNG cho e2e (hậu tố "_test") từ chính
// DATABASE_URL đang cấu hình — không cần thêm biến môi trường mới, và không
// bao giờ đụng tới database dev thật dù chạy nhầm .env nào. adminUrl trỏ vào
// database "postgres" mặc định (luôn tồn tại) vì Postgres không cho phép
// CREATE/DROP DATABASE trong khi đang kết nối vào chính database đó.
export interface TestDatabaseTarget {
  adminUrl: string;
  testUrl: string;
  testDbName: string;
}

export function deriveTestDatabaseTarget(baseUrl: string): TestDatabaseTarget {
  const base = new URL(baseUrl);
  const originalDbName = base.pathname.replace(/^\//, '');
  if (!originalDbName) {
    throw new Error(`DATABASE_URL không có tên database hợp lệ: ${baseUrl}`);
  }
  const testDbName = `${originalDbName}_test`;

  const testUrl = new URL(baseUrl);
  testUrl.pathname = `/${testDbName}`;

  const adminUrl = new URL(baseUrl);
  adminUrl.pathname = '/postgres';

  return {
    adminUrl: adminUrl.toString(),
    testUrl: testUrl.toString(),
    testDbName,
  };
}
