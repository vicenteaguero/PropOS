#!/usr/bin/env bash
# Boots backend (uvicorn :8000) + Vite (:5173) + HTTPS proxy (:5443).
# Set PWA=1 for dev PWA service worker.
# Kills children on exit/SIGINT.

set -u
cd "$(dirname "$0")/.."
ROOT="$PWD"

if [ -f "$ROOT/.env" ]; then
  # Make-style raw .env loader: preserves JSON arrays/quoted values verbatim.
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      ''|'#'*) continue ;;
      *=*)
        key="${line%%=*}"
        val="${line#*=}"
        case "$key" in
          [A-Za-z_]*)
            export "$key=$val"
            ;;
        esac
        ;;
    esac
  done < "$ROOT/.env"
fi

PWA="${PWA:-0}"
LABEL="HMR (no PWA)"
[ "$PWA" = "1" ] && LABEL="HMR + PWA"

VENV="$(cd backend && poetry env info --path 2>/dev/null)"
if [ -z "$VENV" ] || [ ! -x "$VENV/bin/uvicorn" ]; then
  echo "ERROR: poetry venv missing or uvicorn not installed. Run: cd backend && poetry install" >&2
  exit 1
fi

if [ ! -f "$ROOT/frontend/.certs/dev-cert.pem" ] || [ ! -f "$ROOT/frontend/.certs/dev-key.pem" ]; then
  echo "ERROR: dev certs missing in frontend/.certs/. Run mkcert setup." >&2
  exit 1
fi

# Kill any stale procs holding our ports.
lsof -ti:5173,5443,8000 2>/dev/null | xargs kill -9 2>/dev/null || true
pkill -9 -f "uvicorn app.main" 2>/dev/null || true
pkill -9 -f "vite --host" 2>/dev/null || true
pkill -9 -f "local-ssl-proxy" 2>/dev/null || true
sleep 0.3

PIDS=()
cleanup() {
  trap '' INT TERM
  if [ "${#PIDS[@]}" -gt 0 ]; then
    kill -TERM "${PIDS[@]}" 2>/dev/null || true
  fi
  # Hard-kill any stragglers that ignored TERM (uvicorn reloader children, vite optimizers, etc.)
  pkill -9 -P $$ 2>/dev/null || true
  pkill -9 -f "uvicorn app.main" 2>/dev/null || true
  pkill -9 -f "vite --host" 2>/dev/null || true
  pkill -9 -f "https_proxy.mjs" 2>/dev/null || true
  lsof -ti:5173,5443,8000 2>/dev/null | xargs kill -9 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM

LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo '<your-mac-ip>')"
echo "[boot] $LABEL"
echo "[boot] Mac:    https://localhost:5443"
echo "[boot] iPhone: https://$LAN_IP:5443"

# Backend (uvicorn) — direct venv binary, scoped reload
(
  cd "$ROOT/backend"
  exec "$VENV/bin/uvicorn" app.main:app --host 0.0.0.0 --port 8000 --reload --reload-dir app
) 2>&1 | sed -u 's/^/[api]   /' &
PIDS+=($!)

# Vite — direct binary on 5173, HMR over wss:5443 via clientPort
(
  cd "$ROOT/frontend"
  if [ "$PWA" = "1" ]; then export VITE_DEV_PWA=true; fi
  exec ./node_modules/.bin/vite --host 0.0.0.0 --port 5173
) 2>&1 | sed -u 's/^/[vite]  /' &
PIDS+=($!)

# HTTPS proxy 5443 -> 5173 — small inline Node proxy (local-ssl-proxy broken on Node 25)
(
  cd "$ROOT/frontend"
  exec node "$ROOT/scripts/https_proxy.mjs" \
    --source 5443 --target 5173 --hostname 0.0.0.0 \
    --cert .certs/dev-cert.pem --key .certs/dev-key.pem
) 2>&1 | sed -u 's/^/[https] /' &
PIDS+=($!)

wait
