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

STAGING_DIST=".next-staging"
PREVIOUS_DIST=".next-previous"
WORKER_BACKUP=""
WORKER_NEXT=""

# Live PM2 keeps serving .next while the new build is written elsewhere.
# public/sw.js is rewritten by next-pwa during that build, so park it and
# put the previous worker back until the new build is the one being served.
snapshot_workers() {
  local dest="$1"
  mkdir -p "$dest"
  shopt -s nullglob
  local files=(public/sw.js public/workbox-*.js public/worker-*.js public/fallback-*.js)
  local f
  for f in "${files[@]}"; do
    cp -a "$f" "$dest/"
  done
  shopt -u nullglob
}

restore_workers() {
  local src="$1"
  [[ -d "$src" ]] || return 0
  shopt -s nullglob
  rm -f public/sw.js public/workbox-*.js public/worker-*.js public/fallback-*.js
  cp -a "$src"/. public/
  shopt -u nullglob
}

build_staging() {
  WORKER_BACKUP="$(mktemp -d)"
  snapshot_workers "$WORKER_BACKUP"

  rm -rf "$STAGING_DIST"
  if [[ -d .next/cache ]]; then
    mkdir -p "$STAGING_DIST"
    cp -a .next/cache "$STAGING_DIST/cache"
  fi

  log "Building Next.js into $STAGING_DIST (live .next stays in place)"
  if ! NEXT_DIST_DIR="$STAGING_DIST" npm run build; then
    restore_workers "$WORKER_BACKUP"
    return 1
  fi

  WORKER_NEXT="$(mktemp -d)"
  snapshot_workers "$WORKER_NEXT"
  restore_workers "$WORKER_BACKUP"
}

swap_in_staging() {
  rm -rf "$PREVIOUS_DIST"
  if [[ -d .next ]]; then
    mv .next "$PREVIOUS_DIST"
  fi
  mv "$STAGING_DIST" .next
  restore_workers "$WORKER_NEXT"
}

swap_back_previous() {
  if [[ ! -d "$PREVIOUS_DIST" ]]; then
    return 1
  fi
  rm -rf .next-failed
  mv .next .next-failed
  mv "$PREVIOUS_DIST" .next
  restore_workers "$WORKER_BACKUP"
  pm2 restart "$APP_NAME" --update-env
  pm2 save
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
  node scripts/prisma-generate.mjs --for-build
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

# Build beside the live .next, then swap. A build in place deletes the CSS
# the running server is still sending, which blanks the site for minutes.
build_staging
swap_in_staging

pm2 restart "$APP_NAME" --update-env
pm2 save

log "Waiting for health check: $HEALTH_URL"
sleep 2

if ! curl -fsS --max-time 15 "$HEALTH_URL" >/dev/null; then
  log "ERROR: health check failed — restoring previous build ($PREV_SHA)"
  git reset --hard "$PREV_SHA"
  if swap_back_previous; then
    sleep 2
    if curl -fsS --max-time 15 "$HEALTH_URL" >/dev/null; then
      log "Rollback succeeded; still on $PREV_SHA"
      exit 1
    fi
    log "Previous build did not pass health — rebuilding $PREV_SHA"
  fi

  LOCK_SHA="$(file_sha package-lock.json)"
  PREV_LOCK_SHA="$(cat "$LOCKFILE_HASH_FILE" 2>/dev/null || true)"
  if [[ ! -d node_modules ]] || [[ "$LOCK_SHA" != "$PREV_LOCK_SHA" ]]; then
    npm ci --include=dev
    echo "$LOCK_SHA" >"$LOCKFILE_HASH_FILE"
  else
    node scripts/prisma-generate.mjs --for-build
  fi

  build_staging
  swap_in_staging
  pm2 restart "$APP_NAME" --update-env
  pm2 save
  sleep 2
  if curl -fsS --max-time 15 "$HEALTH_URL" >/dev/null; then
    log "Rollback rebuild succeeded; still on $PREV_SHA"
  else
    log "CRITICAL: rollback health check also failed"
  fi
  exit 1
fi

echo "$NEW_SHA" >"$PREV_SHA_FILE"
log "Deploy OK: $NEW_SHA (previous good: $PREV_SHA)"
