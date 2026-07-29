import 'dotenv/config';
import { execSync } from 'node:child_process';
import { Client } from 'pg';
import { deriveTestDatabaseTarget } from './db-test-utils';

// Chạy MỘT LẦN trước toàn bộ suite e2e (Jest globalSetup) — tạo một database
// Postgres riêng, sạch từ đầu, migrate đầy đủ, rồi trỏ DATABASE_URL của tiến
// trình test sang đó. Nhờ vậy `npm run test:e2e` không bao giờ đọc/ghi vào
// database dev thật, và mỗi lần chạy đều bắt đầu từ schema mới tinh (không bị
// dữ liệu/migration cũ từ lần chạy trước làm nhiễu kết quả).
export default async function globalSetup(): Promise<void> {
  const baseUrl = process.env.DATABASE_URL;
  if (!baseUrl) {
    throw new Error(
      'DATABASE_URL chưa được cấu hình (backend/.env) — cần để suy ra database e2e riêng.',
    );
  }

  const { adminUrl, testUrl, testDbName } = deriveTestDatabaseTarget(baseUrl);

  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    // Ngắt kết nối cũ còn sót (vd. lần chạy trước bị Ctrl+C giữa chừng) trước
    // khi DROP — Postgres từ chối DROP DATABASE nếu còn ai đang kết nối vào nó.
    await admin.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [testDbName],
    );
    await admin.query(`DROP DATABASE IF EXISTS "${testDbName}"`);
    await admin.query(`CREATE DATABASE "${testDbName}"`);
  } finally {
    await admin.end();
  }

  execSync('npx prisma migrate deploy', {
    cwd: __dirname + '/..',
    env: { ...process.env, DATABASE_URL: testUrl },
    stdio: 'inherit',
  });

  // Jest chạy globalSetup trong tiến trình cha rồi mới fork worker chạy test
  // file — worker kế thừa process.env này, nên toàn bộ app dưới test (qua
  // PrismaService đọc ConfigService) sẽ tự động kết nối vào DB e2e riêng.
  process.env.DATABASE_URL = testUrl;
  // Truyền cho globalTeardown dọn dẹp đúng database đã tạo.
  process.env.EDUPATH_E2E_TEST_DB_NAME = testDbName;
  process.env.EDUPATH_E2E_ADMIN_URL = adminUrl;
}
