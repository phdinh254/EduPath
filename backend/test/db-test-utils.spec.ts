import { deriveTestDatabaseTarget } from './db-test-utils';

describe('deriveTestDatabaseTarget', () => {
  it('suy ra database _test và admin database "postgres" từ DATABASE_URL, giữ nguyên query string', () => {
    const result = deriveTestDatabaseTarget(
      'postgresql://edupath:edupath@localhost:5432/edupath?schema=public',
    );
    expect(result.testDbName).toBe('edupath_test');
    expect(result.testUrl).toBe(
      'postgresql://edupath:edupath@localhost:5432/edupath_test?schema=public',
    );
    expect(result.adminUrl).toBe(
      'postgresql://edupath:edupath@localhost:5432/postgres?schema=public',
    );
  });

  it('báo lỗi rõ ràng nếu DATABASE_URL không có tên database', () => {
    expect(() =>
      deriveTestDatabaseTarget('postgresql://edupath:edupath@localhost:5432/'),
    ).toThrow();
  });
});
