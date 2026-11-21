#!/usr/bin/env bash
# Single-command initial deploy on a fresh Ubuntu VPS.
set -euo pipefail
cd "$(dirname "$0")"

log() { printf '\n\033[1;32m==> %s\033[0m\n' "$1"; }
warn() { printf '\n\033[1;33mWARNING: %s\033[0m\n' "$1"; }

if [ "$(uname -s)" != "Linux" ]; then warn "This script targets Ubuntu/Linux; continuing anyway."; fi

log "Checking Docker and Compose"
if ! command -v docker >/dev/null 2>&1; then
  log "Installing Docker (official convenience script)"
  curl -fsSL https://get.docker.com | sh
  if [ "$EUID" -ne 0 ]; then sudo usermod -aG docker "$USER" || true; else usermod -aG docker "$USER" || true; fi
else
  echo "Docker found: $(docker --version)"
fi

if ! docker compose version >/dev/null 2>&1; then
  log "Installing the Docker Compose plugin"
  if command -v apt-get >/dev/null 2>&1; then
    if [ "$EUID" -eq 0 ]; then apt-get update -qq && apt-get install -y -qq docker-compose-plugin;
    else sudo apt-get update -qq && sudo apt-get install -y -qq docker-compose-plugin; fi
  else
    warn "Install docker-compose-plugin manually, then rerun this script."
    exit 1
  fi
fi

log "Preparing .env"
if [ ! -f .env ]; then
  cp .env.example .env
  DB_PASSWORD="$(openssl rand -base64 32 | tr -d '/+=' )"
  SESSION_SECRET="$(openssl rand -base64 48 | tr -d '/+=')"
  # Keep DATABASE_URL and POSTGRES_PASSWORD in sync automatically.
  sed -i "s|POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${DB_PASSWORD}|" .env
  sed -i "s|change-me-to-a-long-random-secret|${DB_PASSWORD}|g" .env
  sed -i "s|SESSION_SECRET=.*|SESSION_SECRET=${SESSION_SECRET}|" .env
  echo "Created .env with generated database password and session secret."
else
  echo "Using existing .env (unchanged)."
fi

if ! grep -q '^TUNNEL_TOKEN=.\+' .env; then
  read -r -p "Cloudflare Tunnel token (press Enter to deploy without a tunnel for now): " TOKEN || true
  if [ -n "${TOKEN:-}" ]; then sed -i "s|^TUNNEL_TOKEN=.*|TUNNEL_TOKEN=${TOKEN}|" .env; fi
fi

if ! grep -q '^ADMIN_EMAILS=.\+' .env; then
  read -r -p "Admin email for /admin (press Enter to configure later): " ADMIN_EMAIL || true
  if [ -n "${ADMIN_EMAIL:-}" ]; then sed -i "s|^ADMIN_EMAILS=.*|ADMIN_EMAILS=${ADMIN_EMAIL}|" .env; fi
fi

log "Building images"
docker compose build

log "Starting database, applying exact schema and idempotent seed"
docker compose up -d db
docker compose run --rm migrate

log "Starting the application and Cloudflare Tunnel"
docker compose up -d --build

log "Waiting for the app to become healthy"
for i in $(seq 1 30); do
  if docker compose exec -T app node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
    echo "App is healthy."
    break
  fi
  if [ "$i" -eq 30 ]; then warn "App did not become healthy in 150s. Check: docker compose logs app"; fi
  sleep 5
done

log "Deploy complete"
echo "Site:    $(grep '^APP_URL=' .env | cut -d= -f2-)"
echo "Demo:    demo@trustedsystems.co.ke / Demo123!"
echo "Logs:    docker compose logs -f app cloudflared"
echo "If Cloudflare returns 502, run ./diagnose.sh and check the tunnel's Public Hostname (HTTP, app:3000)."
if grep -q '^ADMIN_EMAILS=.\+' .env; then
  echo "Admin:    $(grep '^ADMIN_EMAILS=' .env | cut -d= -f2-) — create the login with: docker compose run --rm migrate npm run admin:create -- <email> '<password>'"
else
  echo "Admin:    set ADMIN_EMAILS in .env to enable /admin"
fi
