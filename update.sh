#!/usr/bin/env bash
# Single-command update from GitHub on the VPS.
set -euo pipefail
cd "$(dirname "$0")"

log() { printf '\n\033[1;32m==> %s\033[0m\n' "$1"; }

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$BRANCH" = "HEAD" ]; then BRANCH="${1:-main}"; fi

log "Pulling latest changes from origin/$BRANCH"
git fetch origin "$BRANCH"
git pull --ff-only origin "$BRANCH"

if [ ! -f .env ]; then
  echo ".env is missing — run ./deploy.sh once first."
  exit 1
fi

log "Building only changed images"
docker compose build

log "Applying schema/seed updates (idempotent)"
docker compose up -d db
docker compose run --rm --no-deps migrate || docker compose run --rm migrate

log "Restarting only services that changed"
docker compose up -d --remove-orphans

log "Pruning dangling images"
docker image prune -f

log "Update complete"
docker compose ps
