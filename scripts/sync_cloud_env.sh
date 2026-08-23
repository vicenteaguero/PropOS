#!/usr/bin/env bash
# Single source of truth for Cloud Run config: .env
#
# 1. Push sensitive keys to GCP Secret Manager.
# 2. Regenerate config/docker/cloudrun-env.yaml with non-secret keys,
#    auto-applying production overrides (APP_ENV, LOG_LEVEL, ALLOWED_ORIGINS).
#
# Idempotent. Bash 3.2 compatible (macOS default).
# Custom line-based parser preserves literal values (e.g. JSON arrays).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env"
OUT_YAML="$ROOT/config/docker/cloudrun-env.yaml"
APP_FRONTEND_URL="https://app.propos.cl"
PROD_FRONTEND_URL="https://prop-os-delta.vercel.app"
# Staging frontend (branch `dev` -> Vercel project prop-os-edge). It talks to the
# same Cloud Run service, so its origin must be allowed too or staging is dead on
# CORS.
DEV_FRONTEND_URL="https://dev.propos.cl"
EDGE_FRONTEND_URL="https://prop-os-edge.vercel.app"

[ -f "$ENV_FILE" ] || { echo "ERROR: $ENV_FILE missing" >&2; exit 1; }

# Reads file line-by-line, sets KV_<KEY>=<value> shell vars.
# Preserves literal value after = (only strips matched outer single/double quotes).
read_env() {
  local file="$1"
  [ -f "$file" ] || return 0
  local line k v
  while IFS= read -r line || [ -n "$line" ]; do
    [[ -z "${line// }" ]] && continue
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    if [[ "$line" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
      k="${BASH_REMATCH[1]}"
      v="${BASH_REMATCH[2]}"
      if [[ "$v" =~ ^\"(.*)\"$ ]]; then v="${BASH_REMATCH[1]}"; fi
      if [[ "$v" =~ ^\'(.*)\'$ ]]; then v="${BASH_REMATCH[1]}"; fi
      eval "KV_$k=\$v"
    fi
  done < "$file"
}

kv() { local var="KV_$1"; printf '%s' "${!var:-}"; }

read_env "$ENV_FILE"

# === PROD OVERRIDES (applied automatically when generating cloudrun-env.yaml) ===
# .env has dev values; these substitute the prod-correct ones.
KV_APP_ENV="production"
KV_LOG_LEVEL="info"
# Both the propos.cl names and the vercel.app ones. The .vercel.app origins stay
# on purpose: a service worker installed before the domain switch keeps serving
# the old bundle, which still calls the API from the old origin. Drop them once
# every client has taken an update -- roughly a week, not today.
KV_ALLOWED_ORIGINS='["'"$APP_FRONTEND_URL"'","'"$DEV_FRONTEND_URL"'","'"$PROD_FRONTEND_URL"'","'"$EDGE_FRONTEND_URL"'"]'
# The Titan mailbox is out of scope for v0.1.0, so the IMAP poller stays off in
# production regardless of what .env says. Delete this line (and provision
# email-imap-user / email-imap-password) when the mailbox comes into scope.
KV_EMAIL_SYNC_ENABLED="false"

# Sensitive keys -> Secret Manager.
# Keys with no value in .env are skipped, and cloudbuild.yaml only mounts the
# secrets that exist, so listing a not-yet-provisioned integration here is inert
# until you fill it in.
SECRETS=(
  SUPABASE_URL
  SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  VAPID_PUBLIC_KEY
  VAPID_PRIVATE_KEY
  CEREBRAS_API_KEY
  GROQ_API_KEY
  ANTHROPIC_API_KEY
  OPENAI_API_KEY
  KAPSO_API_KEY
  KAPSO_WEBHOOK_SECRET
  KAPSO_PHONE_NUMBER_ID
  RESEND_API_KEY
  INTERNAL_JOBS_SECRET
  AGENT_READONLY_DB_URL
  EMAIL_IMAP_USER
  EMAIL_IMAP_PASSWORD
  CMF_API_KEY
)

# Non-secret keys -> cloudrun-env.yaml (committed to git)
#
# A key the backend reads but that is missing from this array does not fail
# anything: Settings falls back to its code default, silently. That is the same
# trap as the ANITA_* rename, entered from the other side -- the boot guard in
# settings.py catches renamed vars, not omitted ones. `check_settings_drift`
# below closes it by diffing this array against the Settings fields.
NON_SECRETS=(
  APP_ENV
  LOG_LEVEL
  ALLOWED_ORIGINS
  VAPID_CONTACT_EMAIL
  APP_BASE_URL
  AGENT_PROVIDER
  AGENT_MODEL
  AGENT_FALLBACK_PROVIDER
  AGENT_TRANSCRIBE_PROVIDER
  AGENT_DAILY_BUDGET_USD
  AGENT_MAX_TOOL_CALLS_PER_TURN
  AGENT_TURN_TIMEOUT_SECONDS
  AGENT_STRICT_JSON_RETRY
  KAPSO_BASE_URL
  KAPSO_DEFAULT_TEMPLATE_LANG
  CLIENT_AGENT_PROVIDER
  CLIENT_AGENT_MODEL
  CLIENT_AGENT_MAX_HISTORY
  CLIENT_AGENT_BUSINESS_NAME
  RESEND_FROM_EMAIL
  EMAIL_SYNC_ENABLED
  EMAIL_SYNC_TENANT_ID
  UF_SOURCES
)

# Keys that live in .env for local tooling and deliberately never reach Cloud
# Run. Listed so the drift check below can tell "intentionally local" apart from
# "forgotten".
LOCAL_ONLY=(
  EMAIL_IMAP_HOST
  EMAIL_IMAP_PORT
)

if [ "${SKIP_SECRETS:-}" = "1" ]; then
  echo "=== SKIP_SECRETS=1 — skipping Secret Manager sync ==="
else
  echo "=== syncing secrets to GCP Secret Manager ==="
  for key in "${SECRETS[@]}"; do
    value="$(kv "$key")"
    if [ -z "$value" ]; then
      echo "skip      $key (empty in .env)"
      continue
    fi
    secret_name=$(echo "$key" | tr '[:upper:]_' '[:lower:]-')
    if gcloud secrets describe "$secret_name" >/dev/null 2>&1; then
      current=$(gcloud secrets versions access latest --secret="$secret_name" 2>/dev/null || echo "")
      if [ "$current" = "$value" ]; then
        echo "unchanged $secret_name"
      else
        printf '%s' "$value" | gcloud secrets versions add "$secret_name" --data-file=- >/dev/null
        echo "updated   $secret_name"
      fi
    else
      printf '%s' "$value" | gcloud secrets create "$secret_name" \
        --data-file=- --replication-policy=automatic >/dev/null
      echo "created   $secret_name"
    fi
  done
fi

echo ""
echo "=== regenerating $OUT_YAML (with prod overrides) ==="
{
  echo "# AUTO-GENERATED by scripts/sync_cloud_env.sh — do not edit manually."
  echo "# Source: .env. Prod overrides applied: APP_ENV, LOG_LEVEL, ALLOWED_ORIGINS."
  echo "# Run: make deploy-secrets-sync"
  for key in "${NON_SECRETS[@]}"; do
    value="$(kv "$key")"
    [ -z "$value" ] && continue
    escaped="${value//\'/\'\'}"
    printf "%s: '%s'\n" "$key" "$escaped"
  done
} > "$OUT_YAML"

echo "wrote $OUT_YAML"

# === DRIFT CHECK ===
# Every field on Settings is something the backend reads. If .env sets one and
# neither array carries it, Cloud Run runs on the code default while .env says
# otherwise -- invisible until the two disagree. Parse the field names straight
# out of settings.py (no venv needed) and report the gap.
check_settings_drift() {
  local settings_py="$ROOT/backend/app/core/config/settings.py"
  [ -f "$settings_py" ] || return 0

  local transported=" ${SECRETS[*]} ${NON_SECRETS[*]} ${LOCAL_ONLY[*]} "
  local missing=()
  local field upper value

  # Class-body annotations only: four leading spaces, `name: type`.
  while IFS= read -r field; do
    upper=$(echo "$field" | tr '[:lower:]' '[:upper:]')
    case "$transported" in *" $upper "*) continue ;; esac
    value="$(kv "$upper")"
    [ -z "$value" ] && continue
    missing+=("$upper")
  done < <(sed -n 's/^    \([a-z_][a-z0-9_]*\): .*/\1/p' "$settings_py")

  if [ ${#missing[@]} -gt 0 ]; then
    echo ""
    echo "WARNING: set in .env, read by Settings, NOT sent to Cloud Run:"
    printf '  %s\n' "${missing[@]}"
    echo "  -> add each to SECRETS or NON_SECRETS in $(basename "$0"), or to LOCAL_ONLY if deliberate."
  fi
}

check_settings_drift

echo ""
echo "Next: git add + commit + push (auto-deploys via Cloud Build trigger)."
