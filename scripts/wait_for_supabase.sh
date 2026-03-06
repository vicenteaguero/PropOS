#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_SCRIPT="${SCRIPT_DIR}/scripts/log.sh"
MAX_WAIT=30
INTERVAL=2
ELAPSED=0

bash "${LOG_SCRIPT}" SUPABASE "🔄" "Waiting for Supabase at ${SUPABASE_URL}"

while [ "${ELAPSED}" -lt "${MAX_WAIT}" ]; do
    if curl -sf "${SUPABASE_URL}/rest/v1/" -o /dev/null 2>&1; then
        bash "${LOG_SCRIPT}" SUPABASE "✅" "Supabase is reachable"
        exit 0
    fi
    sleep "${INTERVAL}"
    ELAPSED=$((ELAPSED + INTERVAL))
    bash "${LOG_SCRIPT}" SUPABASE "⚠️" "Supabase not ready — retrying (${ELAPSED}s/${MAX_WAIT}s)"
done

bash "${LOG_SCRIPT}" SUPABASE "❌" "Supabase failed to respond within ${MAX_WAIT}s"
exit 1
