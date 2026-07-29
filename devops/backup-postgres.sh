#!/usr/bin/env bash
# Backup toàn bộ database PostgreSQL của EduPath bằng pg_dump (custom format,
# nén sẵn, phục hồi được từng phần bằng pg_restore).
#
# Cách dùng:
#   ./backup-postgres.sh                     # backup qua container Docker "postgres" đang chạy
#   COMPOSE_FILE=docker-compose.prod.yml ./backup-postgres.sh
#   DATABASE_URL=postgresql://... ./backup-postgres.sh   # backup trực tiếp, không qua Docker
#
# Đặt trong cron để chạy định kỳ, vd. backup hằng ngày lúc 2h sáng:
#   0 2 * * * cd /path/to/EduPath/devops && ./backup-postgres.sh >> /var/log/edupath-backup.log 2>&1
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$SCRIPT_DIR/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
OUT_FILE="$BACKUP_DIR/edupath_$TIMESTAMP.dump"

mkdir -p "$BACKUP_DIR"

if [ -n "${DATABASE_URL:-}" ]; then
  echo "Backup trực tiếp qua DATABASE_URL vào $OUT_FILE"
  pg_dump --format=custom --file="$OUT_FILE" "$DATABASE_URL"
else
  echo "Backup qua container postgres ($COMPOSE_FILE) vào $OUT_FILE"
  docker compose -f "$SCRIPT_DIR/$COMPOSE_FILE" exec -T postgres \
    pg_dump --format=custom -U edupath edupath > "$OUT_FILE"
fi

echo "Đã backup: $OUT_FILE ($(du -h "$OUT_FILE" | cut -f1))"

# Xoá bản backup cũ hơn KEEP_DAYS ngày — tránh disk đầy trên máy chủ chạy cron dài hạn.
find "$BACKUP_DIR" -name 'edupath_*.dump' -mtime "+$KEEP_DAYS" -print -delete
