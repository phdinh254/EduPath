# Quy trình rollback migration Prisma

Prisma Migrate không tự sinh migration "down" — mỗi thư mục trong
`backend/prisma/migrations/` chỉ chứa `migration.sql` theo chiều tiến (up).
Rollback vì vậy luôn là thao tác **thủ công**: viết SQL đảo ngược rồi tự tay
áp dụng, không có lệnh `prisma migrate down` để gọi.

Có 2 tình huống rollback khác nhau — chọn đúng tình huống trước khi làm theo
các bước bên dưới.

## Tình huống A — Migration mới lỗi, CHƯA merge/CHƯA chạy ở production

Đây là trường hợp phổ biến nhất: vừa `prisma migrate dev` ở máy dev, phát
hiện sai, muốn xoá đi làm lại.

```bash
cd backend
# Xoá thư mục migration vừa tạo (thay tên đúng migration cần bỏ)
rm -rf prisma/migrations/20260729999999_ten_migration_sai

# Đưa database dev về đúng trạng thái các migration còn lại
npx prisma migrate reset   # XOÁ SẠCH DATA — chỉ chạy trên DB dev/test, không bao giờ chạy trên production
```

## Tình huống B — Migration đã chạy ở production, cần revert

Không được xoá thư mục migration đã áp dụng ở production (sẽ làm lệch giữa
các môi trường và khiến `prisma migrate deploy` báo drift ở lần chạy sau).
Thay vào đó:

### Bước 1 — Backup trước khi làm bất cứ điều gì

```bash
cd devops
./backup-postgres.sh
```

### Bước 2 — Viết SQL đảo ngược thủ công

Mở `migration.sql` của migration cần revert, viết SQL ngược lại tương ứng.
Ví dụ migration gần nhất `20260729153000_user_login_lockout` chỉ thêm 2 cột:

```sql
-- migration.sql (chiều up, đã áp dụng)
ALTER TABLE "User" ADD COLUMN     "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lockedUntil" TIMESTAMP(3);
```

SQL đảo ngược tương ứng (chạy trực tiếp, KHÔNG tạo migration mới cho việc này):

```sql
ALTER TABLE "User" DROP COLUMN "failedLoginAttempts",
DROP COLUMN "lockedUntil";
```

Nguyên tắc khi viết SQL đảo ngược:

| Up đã làm | SQL đảo ngược |
|---|---|
| `ADD COLUMN` | `DROP COLUMN` |
| `DROP COLUMN` | `ADD COLUMN` (⚠️ **mất dữ liệu cũ của cột đó vĩnh viễn** — nếu cần giữ, phải phục hồi từ backup ở Bước 1 thay vì chạy SQL này) |
| `CREATE TABLE` | `DROP TABLE` |
| `ADD CONSTRAINT` | `DROP CONSTRAINT` |
| Đổi tên cột/bảng | Đổi tên ngược lại |

### Bước 3 — Áp dụng SQL đảo ngược lên database

```bash
psql "$DATABASE_URL" -f rollback.sql
```

### Bước 4 — Đánh dấu migration là "đã rollback" trong Prisma

Prisma theo dõi migration đã áp dụng qua bảng `_prisma_migrations`. Sau khi
tay đã revert schema thật, phải báo cho Prisma biết để nó không nghĩ migration
đó vẫn đang có hiệu lực:

```bash
npx prisma migrate resolve --rolled-back "20260729153000_user_login_lockout"
```

Lệnh này chỉ xoá dòng ghi nhận trong `_prisma_migrations`, không đụng vào
schema — schema thật đã được revert thủ công ở Bước 3.

### Bước 5 — Xoá thư mục migration khỏi source code

Chỉ xoá **sau khi** Bước 3 và 4 đã chạy thành công ở mọi môi trường đang dùng
migration đó (production, staging...), để `prisma migrate deploy` ở các môi
trường còn lại không cố áp dụng lại một migration đã bị revert.

```bash
rm -rf backend/prisma/migrations/20260729153000_user_login_lockout
```

### Bước 6 — Restart backend

Prisma Client được generate dựa trên `schema.prisma` hiện tại — nếu revert có
kèm sửa `schema.prisma` (bỏ field tương ứng), chạy lại `npx prisma generate`
rồi restart backend để tránh Prisma Client tham chiếu cột không còn tồn tại.

## Khi nào KHÔNG nên rollback bằng cách này

Nếu migration cần revert đã có migration khác chạy sau nó và phụ thuộc vào
thay đổi đó (vd. migration sau có `NOT NULL` dựa trên cột migration này thêm
vào), rollback thủ công dễ để lại schema không nhất quán. Trường hợp này nên
viết một migration **mới** (up) để sửa lại, thay vì revert migration cũ —
an toàn hơn vì đi theo đúng lịch sử tuyến tính mà Prisma mong đợi.
