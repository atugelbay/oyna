#!/usr/bin/env bash
# Сборка и перезапуск на VPS. Не вызывает seed — только миграции.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export NODE_ENV=production

echo "==> OYNA deploy from $ROOT"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js не найден в PATH. Установите Node 20+ или подключите nvm."
  exit 1
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "PM2 не найден. Установите: npm i -g pm2"
  exit 1
fi

# ─── Backend ─────────────────────────────────────────────────
cd "$ROOT/backend"
if [[ ! -f .env ]]; then
  echo "Нет backend/.env — скопируйте deploy/env/backend.env.example и заполните."
  exit 1
fi

npm ci
npx prisma generate
npm run db:migrate:prod
npm run build

# ─── Frontend (NEXT_PUBLIC_* читаются на этапе build) ─────────
cd "$ROOT/frontend"
if [[ ! -f .env.production ]]; then
  echo "Нет frontend/.env.production — скопируйте deploy/env/frontend.env.example и заполните."
  exit 1
fi

npm ci
npm run build

# ─── PM2 ─────────────────────────────────────────────────────
cd "$ROOT"
pm2 startOrReload "$ROOT/deploy/ecosystem.config.cjs" --update-env
pm2 save

echo "==> Готово. Проверьте: pm2 status, nginx, curl localhost:3000/api/docs"
