import { Client } from 'pg';

// Chạy MỘT LẦN sau khi toàn bộ suite e2e xong (kể cả khi có test fail) — xoá
// hẳn database e2e riêng đã tạo ở globalSetup, không để lại rác giữa các lần
// chạy CI/local.
export default async function globalTeardown(): Promise<void> {
  const adminUrl = process.env.EDUPATH_E2E_ADMIN_URL;
  const testDbName = process.env.EDUPATH_E2E_TEST_DB_NAME;
  if (!adminUrl || !testDbName) return;

  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    await admin.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [testDbName],
    );
    await admin.query(`DROP DATABASE IF EXISTS "${testDbName}"`);
  } finally {
    await admin.end();
  }
}
