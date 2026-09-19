#!/usr/bin/env bash
# Production deploy for Nabra / Wengz on Hostinger VPS.
# Install: sudo install -m 755 scripts/deploy-nabra.sh /usr/local/bin/deploy-nabra.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/nabra-ai-system}"
APP_NAME="${APP_NAME:-nabra-ai-system}"
BRANCH="${DEPLOY_BRANCH:-main}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/api/health}"
LOG_FILE="${LOG_FILE:-/var/log/nabra-deploy.log}"
STATE_DIR="${STATE_DIR:-/var/lib/nabra}"
PREV_SHA_FILE="${STATE_DIR}/last-good-sha"
LOCK_FILE="${STATE_DIR}/deploy.lock"
LOCKFILE_HASH_FILE="${STATE_DIR}/package-lock.sha256"
SCHEMA_HASH_FILE="${STATE_DIR}/prisma-schema.sha256"

mkdir -p "$(dirname "$LOG_FILE")" "$STATE_DIR"

# Keep Actions/SSH stdout visible while still appending to the deploy log.
exec > >(tee -a "$LOG_FILE") 2>&1

log() {
  printf '[%s] %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*"
}

file_sha() {
  sha256sum "$1" | awk '{print $1}'
}

cleanup() {
  rm -f "$LOCK_FILE"
}
trap cleanup EXIT

if [[ -f "$LOCK_FILE" ]]; then
  LOCK_PID="$(tr -d '[:space:]' <"$LOCK_FILE" || true)"
  if [[ -n "$LOCK_PID" ]] && kill -0 "$LOCK_PID" 2>/dev/null; then
    log "ERROR: deploy already in progress (pid=$LOCK_PID lock=$LOCK_FILE)"
    exit 1
  fi
  log "WARN: clearing stale deploy lock (pid=$LOCK_PID no longer running)"
  rm -f "$LOCK_FILE"
fi
echo $$ >"$LOCK_FILE"

cd "$APP_DIR"

if [[ ! -f .env ]]; then
  log "ERROR: missing $APP_DIR/.env — secrets stay on the VPS, aborting"
  exit 1
fi

PREV_SHA="$(git rev-parse HEAD)"
log "Starting deploy on branch=$BRANCH from sha=$PREV_SHA"

git fetch --prune origin
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

NEW_SHA="$(git rev-parse HEAD)"
log "Checked out $NEW_SHA"

if [[ -f "$APP_DIR/scripts/deploy-nabra.sh" ]]; then
  install -m 755 "$APP_DIR/scripts/deploy-nabra.sh" /usr/local/bin/deploy-nabra.sh || true
fi

export NODE_ENV=production
export HUSKY=0

LOCK_SHA="$(file_sha package-lock.json)"
PREV_LOCK_SHA="$(cat "$LOCKFILE_HASH_FILE" 2>/dev/null || true)"
if [[ ! -d node_modules ]] || [[ "$LOCK_SHA" != "$PREV_LOCK_SHA" ]]; then
  log "Dependencies changed (or missing) — running npm ci"
  npm ci --include=dev
  echo "$LOCK_SHA" >"$LOCKFILE_HASH_FILE"
else
  log "Skipping npm ci (package-lock unchanged)"
  npx prisma generate
fi

SCHEMA_SHA="$(file_sha prisma/schema.prisma)"
PREV_SCHEMA_SHA="$(cat "$SCHEMA_HASH_FILE" 2>/dev/null || true)"
if [[ "$SCHEMA_SHA" != "$PREV_SCHEMA_SHA" ]]; then
  # --accept-data-loss is required for intentional column drops (e.g. hasWhatsapp).
  # Deploy already runs only when schema hash changes; review schema diffs before merge.
  log "Prisma schema changed — running db:push --accept-data-loss"
  npm run db:push
  echo "$SCHEMA_SHA" >"$SCHEMA_HASH_FILE"
else
  log "Skipping db:push (schema unchanged)"
fi

# .next/cache is gitignored and survives reset — keeps rebuilds faster.
log "Building Next.js"
npm run build

pm2 restart "$APP_NAME" --update-env
pm2 save

log "Waiting for health check: $HEALTH_URL"
sleep 2

if ! curl -fsS --max-time 15 "$HEALTH_URL" >/dev/null; then
  log "ERROR: health check failed — rolling back to $PREV_SHA"
  git reset --hard "$PREV_SHA"

  LOCK_SHA="$(file_sha package-lock.json)"
  PREV_LOCK_SHA="$(cat "$LOCKFILE_HASH_FILE" 2>/dev/null || true)"
  if [[ ! -d node_modules ]] || [[ "$LOCK_SHA" != "$PREV_LOCK_SHA" ]]; then
    npm ci --include=dev
    echo "$LOCK_SHA" >"$LOCKFILE_HASH_FILE"
  else
    npx prisma generate
  fi

  npm run build
  pm2 restart "$APP_NAME" --update-env
  pm2 save
  sleep 2
  if curl -fsS --max-time 15 "$HEALTH_URL" >/dev/null; then
    log "Rollback succeeded; still on $PREV_SHA"
  else
    log "CRITICAL: rollback health check also failed"
  fi
  exit 1
fi

echo "$NEW_SHA" >"$PREV_SHA_FILE"
log "Deploy OK: $NEW_SHA (previous good: $PREV_SHA)"
