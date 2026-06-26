#!/usr/bin/env bash
set -euo pipefail

FILE="${1:-}"
CONTAINER="${PG_CONTAINER:-foodize_pg}"
DB="${POSTGRES_DB:-foodize}"
USER="${POSTGRES_USER:-foodize_user}"

if [[ -z "$FILE" ]]; then
  echo "Usage: $0 <backup_file.dump>"
  exit 1
fi

if [[ ! -f "$FILE" ]]; then
  echo "[restore] File not found: $FILE"
  exit 1
fi

echo "[restore] Restoring $DB in container $CONTAINER from $FILE..."
echo "[restore] WARNING: This will DROP and recreate the database!"
read -r -p "Type 'yes' to continue: " CONFIRM
if [[ "$CONFIRM" != "yes" ]]; then
  echo "[restore] Aborted."
  exit 0
fi

docker exec -i "$CONTAINER" psql -U "$USER" -c "DROP DATABASE IF EXISTS ${DB};"
docker exec -i "$CONTAINER" psql -U "$USER" -c "CREATE DATABASE ${DB} OWNER ${USER};"
docker exec -i "$CONTAINER" pg_restore -U "$USER" -d "$DB" --no-owner --role="$USER" < "$FILE"

echo "[restore] Done. Database $DB restored from $FILE."
