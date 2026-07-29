#!/usr/bin/env bash
# Phục hồi database PostgreSQL của EduPath từ một file backup do backup-postgres.sh tạo ra.
#
# CẢNH BÁO: lệnh này XOÁ SẠCH schema "public" hiện tại trước khi phục hồi (--clean),
# để tránh xung đột dữ liệu cũ/mới. Luôn xác nhận đúng file backup và đúng môi trường
# (không chạy nhầm vào production khi đang test) trước khi tiếp tục.
#
# Cách dùng:
#   ./restore-postgres.sh backups/edupath_20260729_020000.dump
#   COMPOSE_FILE=docker-compose.prod.yml ./restore-postgres.sh <file>
#   DATABASE_URL=postgresql://... ./restore-postgres.sh <file>   # phục hồi trực tiếp, không qua Docker
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"

DUMP_FILE="${1:?Cách dùng: ./restore-postgres.sh <file.dump>}"
if [ ! -f "$DUMP_FILE" ]; then
  echo "Không tìm thấy file backup: $DUMP_FILE" >&2
  exit 1
fi

read -r -p "Xác nhận phục hồi từ '$DUMP_FILE' — sẽ XOÁ dữ liệu hiện tại. Gõ 'yes' để tiếp tục: " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Đã huỷ."
  exit 1
fi

if [ -n "${DATABASE_URL:-}" ]; then
  echo "Phục hồi trực tiếp qua DATABASE_URL từ $DUMP_FILE"
  pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_URL" "$DUMP_FILE"
else
  echo "Phục hồi qua container postgres ($COMPOSE_FILE) từ $DUMP_FILE"
  docker compose -f "$SCRIPT_DIR/$COMPOSE_FILE" exec -T postgres \
    pg_restore --clean --if-exists --no-owner -U edupath -d edupath < "$DUMP_FILE"
fi

echo "Phục hồi xong. Kiểm tra lại dữ liệu và khởi động lại backend nếu cần."
