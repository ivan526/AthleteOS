#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

"$ROOT_DIR/scripts/init-dev-db.sh"

if [ ! -d "$ROOT_DIR/backend/node_modules" ]; then
  (cd "$ROOT_DIR/backend" && npm install)
fi

if [ ! -d "$ROOT_DIR/frontend/node_modules" ]; then
  (cd "$ROOT_DIR/frontend" && npm install)
fi

(cd "$ROOT_DIR/backend" && npm run start -- --watch=false) &
BACKEND_PID=$!

(cd "$ROOT_DIR/frontend" && npm run dev -- --host 127.0.0.1) &
FRONTEND_PID=$!

cleanup() {
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "AthleteOS is starting:"
echo "  Frontend: http://127.0.0.1:3000"
echo "  Backend:  http://127.0.0.1:3007"

wait
