#!/usr/bin/env bash
# Boots full stack via docker-compose (api+frontend) plus host-side HTTPS proxy on :5443
# so iPhone over LAN gets HTTPS + wss HMR. Workaround for Tahoe Node bug that breaks
# the local poetry/babel toolchain — only the proxy runs on host (Node, no babel deps).
#
# Env:
#   PWA=1     enable Vite PWA service worker in dev (VITE_DEV_PWA=true)
#   KAPSO=1   also spawn cloudflared tunnel -> http://localhost:8000 for Kapso webhook

set -u
cd "$(dirname "$0")/.."
ROOT="$PWD"

PWA="${PWA:-0}"
KAPSO="${KAPSO:-0}"
LABEL="docker HMR (no PWA)"
[ "$PWA" = "1" ] && LABEL="docker HMR + PWA"
[ "$KAPSO" = "1" ] && LABEL="$LABEL + Kapso tunnel"

if [ ! -f "$ROOT/frontend/.certs/dev-cert.pem" ] || [ ! -f "$ROOT/frontend/.certs/dev-key.pem" ]; then
  echo "ERROR: dev certs missing in frontend/.certs/. Run mkcert setup." >&2
  exit 1
fi

# Free host port 5443 (proxy) before starting.
lsof -ti:5443 2>/dev/null | xargs kill -9 2>/dev/null || true
pkill -9 -f "https_proxy.mjs" 2>/dev/null || true
[ "$KAPSO" = "1" ] && pkill -9 -f "cloudflared tunnel --url http://localhost:8000" 2>/dev/null || true

PIDS=()
cleanup() {
  trap '' INT TERM
  if [ "${#PIDS[@]}" -gt 0 ]; then
    kill -TERM "${PIDS[@]}" 2>/dev/null || true
  fi
  pkill -9 -P $$ 2>/dev/null || true
  pkill -9 -f "https_proxy.mjs" 2>/dev/null || true
  [ "$KAPSO" = "1" ] && pkill -9 -f "cloudflared tunnel --url http://localhost:8000" 2>/dev/null || true
  echo ""
  echo "[boot] stopping docker stack"
  docker compose stop >/dev/null 2>&1 || true
  exit 0
}
trap cleanup INT TERM

LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo '<your-mac-ip>')"
echo "[boot] $LABEL"
echo "[boot] Mac:    https://localhost:5443"
echo "[boot] iPhone: https://$LAN_IP:5443"

# Start docker stack (foreground build, then detach api+frontend)
if [ "$PWA" = "1" ]; then
  VITE_DEV_PWA=true docker compose up -d --build api frontend
else
  VITE_DEV_PWA=false docker compose up -d --build api frontend
fi

# Wait for vite to bind 5173 in container.
for i in $(seq 1 30); do
  if curl -sf -o /dev/null --max-time 1 http://localhost:5173/; then break; fi
  sleep 0.5
done

# Tail docker logs in background
docker compose logs -f api frontend 2>&1 | sed -u 's/^/[docker] /' &
PIDS+=($!)

# HTTPS proxy 5443 -> docker-mapped 5173
(
  cd "$ROOT/frontend"
  exec node "$ROOT/scripts/https_proxy.mjs" \
    --source 5443 --target 5173 --hostname 0.0.0.0 \
    --cert .certs/dev-cert.pem --key .certs/dev-key.pem
) 2>&1 | sed -u 's/^/[https] /' &
PIDS+=($!)

# Optional Kapso webhook tunnel (cloudflared -> host:8000 -> docker api)
if [ "$KAPSO" = "1" ]; then
  if ! command -v cloudflared >/dev/null 2>&1; then
    echo "[kapso] WARN: cloudflared not installed; skipping tunnel" >&2
  else
    echo "[kapso] cloudflared tunnel -> http://localhost:8000 (set Kapso webhook to printed URL + /api/v1/integrations/kapso/webhook)"
    cloudflared tunnel --url http://localhost:8000 2>&1 | sed -u 's/^/[kapso] /' &
    PIDS+=($!)
  fi
fi

wait
