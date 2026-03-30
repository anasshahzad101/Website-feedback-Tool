#!/usr/bin/env bash
# One-shot deploy on the VPS: pull, install, migrate, build, PM2 restart.
# Usage: ./scripts/deploy-vps.sh [APP_DIR]
# Default APP_DIR: $DEPLOY_APP_DIR or /var/www/website-feedback-tool
set -euo pipefail

APP_DIR="${1:-${DEPLOY_APP_DIR:-/var/www/website-feedback-tool}}"
cd "$APP_DIR"

echo "==> Deploy in $APP_DIR"

if [[ ! -f package.json ]]; then
  echo "No package.json in $APP_DIR — check path." >&2
  exit 1
fi

git fetch origin
current_branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$current_branch" != "main" ]]; then
  git checkout main
fi
git pull --ff-only origin main

# Match low fan-out used in npm/.npmrc and next build (shared host process limits).
export UV_THREADPOOL_SIZE="${UV_THREADPOOL_SIZE:-1}"
export VIPS_CONCURRENCY="${VIPS_CONCURRENCY:-1}"
export NEXT_TELEMETRY_DISABLED="${NEXT_TELEMETRY_DISABLED:-1}"

npm ci --no-audit --no-fund
npx prisma migrate deploy
npm run build
# Fewer packages at runtime (build already ran; do not use --omit=dev before build).
npm run prune:dev

if pm2 describe website-feedback-tool >/dev/null 2>&1; then
  pm2 restart website-feedback-tool --update-env
else
  if [[ -f ecosystem.config.cjs ]]; then
    pm2 start ecosystem.config.cjs
  else
    echo "PM2 app not running and no ecosystem.config.cjs — start manually (see ecosystem.config.example.cjs)." >&2
    exit 1
  fi
fi

echo "==> Done"
