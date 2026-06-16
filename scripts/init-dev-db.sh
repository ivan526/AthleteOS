#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_PATH="$ROOT_DIR/backend/prisma/dev.db"
MIGRATION_SQL="$ROOT_DIR/backend/prisma/migrations/20260615160103_init/migration.sql"

mkdir -p "$(dirname "$DB_PATH")"

if sqlite3 "$DB_PATH" "SELECT name FROM sqlite_master WHERE type='table' AND name='User';" | grep -q User; then
  echo "SQLite dev database is ready: $DB_PATH"
  exit 0
fi

sqlite3 "$DB_PATH" < "$MIGRATION_SQL"
echo "SQLite dev database initialized: $DB_PATH"
