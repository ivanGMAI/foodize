#!/usr/bin/env bash
set -euo pipefail

CONTAINER="${PG_CONTAINER:-foodize_pg}"
DB="${POSTGRES_DB:-foodize}"
USER="${POSTGRES_USER:-foodize_user}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILE="${BACKUP_DIR}/foodize_${TIMESTAMP}.dump"

mkdir -p "$BACKUP_DIR"

echo "[backup] Dumping $DB from container $CONTAINER..."
docker exec "$CONTAINER" pg_dump -U "$USER" -Fc "$DB" > "$FILE"
echo "[backup] Saved to $FILE ($(du -sh "$FILE" | cut -f1))"

KEEP="${KEEP_LAST:-7}"
echo "[backup] Keeping last $KEEP backups..."
ls -t "$BACKUP_DIR"/*.dump 2>/dev/null | tail -n +"$((KEEP + 1))" | xargs -r rm --
echo "[backup] Done."
