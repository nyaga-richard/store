#!/usr/bin/env bash
# Read-only checks for the most common Cloudflare Tunnel 502 causes.
set -uo pipefail
cd "$(dirname "$0")"

log() { printf '\n\033[1;32m==> %s\033[0m\n' "$1"; }
warn() { printf '\n\033[1;33mWARNING: %s\033[0m\n' "$1"; }

log "Compose services"
docker compose ps || true

log "App health from inside the app container"
docker compose exec -T app node -e \
  "fetch('http://127.0.0.1:3000/api/health').then(async r => { console.log(r.status, await r.text()); process.exit(r.ok ? 0 : 1) }).catch(e => { console.error(e.message); process.exit(1) })" \
  || warn "App health check failed — see: docker compose logs app"

log "Origin reachability from the tunnel's Docker network"
NETWORK="${NETWORK_NAME:-trustedsystems-store_storenet}"
if docker network inspect "$NETWORK" >/dev/null 2>&1; then
  docker run --rm --network "$NETWORK" curlimages/curl:latest \
    -sS -i --max-time 10 http://app:3000/api/health || warn "app:3000 is NOT reachable from the tunnel network."
else
  warn "Network $NETWORK not found; check docker network ls."
fi

log "Tunnel credential present?"
if grep -q '^TUNNEL_TOKEN=.\+' .env 2>/dev/null; then echo "TUNNEL_TOKEN is set (value hidden)."; else warn "TUNNEL_TOKEN is empty or .env is missing."; fi

log "Last cloudflared log lines"
docker compose logs --tail=100 cloudflared || true

cat <<'GUIDE'

Cloudflare 502 checklist
------------------------
1. Zero Trust -> Networks -> Tunnels -> your tunnel -> Public Hostname:
     Hostname:     shop.trustedsystems.co.ke
     Service Type: HTTP        <-- NOT HTTPS
     URL:          app:3000    <-- NOT localhost / 127.0.0.1 / port 3000 alone
   Save the row, then wait ~30 seconds.

2. DNS -> shop.trustedsystems.co.ke must be a proxied (orange cloud) CNAME
   to <tunnel-id>.cfargotunnel.com, created by that Public Hostname.
   If you created an A/AAAA record manually, remove it.

3. The token in .env must belong to the tunnel that owns the hostname above.
   After rotating a token: docker compose up -d --force-recreate cloudflared

4. Check from your laptop:  curl -i https://shop.trustedsystems.co.ke/api/health
   Expected: HTTP/2 200 and {"status":"ok","database":true}

Common cloudflared log giveaways:
  "connection refused" / "dial tcp" -> wrong Service URL (use app:3000)
  "TLS handshake"                    -> Service Type is HTTPS; change to HTTP
  "invalid tunnel token"             -> rotate/replace TUNNEL_TOKEN
GUIDE
