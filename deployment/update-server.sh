#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/home/ubuntu/workspace/athlete-os}"
BACKUP_ROOT="${BACKUP_ROOT:-/home/ubuntu/backups}"
WEB_ROOT="${WEB_ROOT:-/var/www/athleteos}"
BRANCH="${BRANCH:-master}"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$BACKUP_ROOT/athleteos-$STAMP"

cd "$APP_DIR"

if [ -n "$(git status --porcelain)" ]; then
  echo "Refusing to update: the server worktree has uncommitted changes." >&2
  git status --short >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
if [ -f backend/prisma/dev.db ]; then
  cp -a backend/prisma/dev.db "$BACKUP_DIR/dev.db"
fi
if [ -f backend/.env ]; then
  cp -a backend/.env "$BACKUP_DIR/backend.env"
  chmod 600 "$BACKUP_DIR/backend.env"
fi
git rev-parse HEAD > "$BACKUP_DIR/previous-commit.txt"

git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

(
  cd backend
  npm ci
  npx prisma generate
  npx prisma migrate deploy
  npm run build
)

(
  cd frontend
  npm ci
  npm run build
)

sudo mkdir -p "$WEB_ROOT"
sudo rsync -a --delete frontend/dist/ "$WEB_ROOT/"
sudo chown -R www-data:www-data "$WEB_ROOT"
sudo systemctl restart athleteos-backend
sudo nginx -t
sudo systemctl reload nginx

for attempt in {1..15}; do
  if curl -fsS http://127.0.0.1:3007/ >/dev/null; then
    break
  fi
  if [ "$attempt" -eq 15 ]; then
    echo "Backend health check failed after 30 seconds." >&2
    sudo systemctl --no-pager --full status athleteos-backend >&2 || true
    exit 1
  fi
  sleep 2
done

curl -fsS http://127.0.0.1/healthz >/dev/null

echo "AthleteOS updated to $(git rev-parse --short HEAD)"
echo "Backup saved to $BACKUP_DIR"
