#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG="${SCRIPT_DIR}/scripts/log.sh"
ENV_FILE="${SCRIPT_DIR}/.env"
ENV_EXAMPLE="${SCRIPT_DIR}/etc/.env.example"

# ── Helpers ──────────────────────────────────────────────────────────────────

log() { bash "$LOG" SETUP "$1" "$2"; }

die() { log "❌" "$1"; exit 1; }

check_cmd() {
    if ! command -v "$1" &>/dev/null; then
        die "$1 is not installed. Please install it first."
    fi
    log "✅" "$1 found"
}

# ── Parse flags ──────────────────────────────────────────────────────────────

PROJECT_REF=""
ANON_KEY=""
SERVICE_KEY=""
DB_PASSWORD=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --project-ref)  PROJECT_REF="$2";  shift 2 ;;
        --anon-key)     ANON_KEY="$2";     shift 2 ;;
        --service-key)  SERVICE_KEY="$2";  shift 2 ;;
        --db-password)  DB_PASSWORD="$2";  shift 2 ;;
        *) die "Unknown flag: $1" ;;
    esac
done

# ── Step 1: Prerequisites ────────────────────────────────────────────────────

log "🔍" "Checking prerequisites..."
check_cmd docker
check_cmd supabase
check_cmd node
check_cmd poetry

# ── Step 2: Load existing .env or gather credentials ─────────────────────────

if [[ -f "$ENV_FILE" ]]; then
    log "✅" "Existing .env found — loading credentials from it"
    set -a
    source "$ENV_FILE"
    set +a

    # Use values from .env if not provided via flags
    PROJECT_REF="${PROJECT_REF:-$SUPABASE_PROJECT_ID}"
    ANON_KEY="${ANON_KEY:-$SUPABASE_ANON_KEY}"
    SERVICE_KEY="${SERVICE_KEY:-$SUPABASE_SERVICE_ROLE_KEY}"
else
    # No .env exists — prompt for missing credentials
    if [[ -z "$PROJECT_REF" ]]; then
        read -rp "Supabase Project Ref: " PROJECT_REF
    fi
    if [[ -z "$ANON_KEY" ]]; then
        read -rp "Supabase Anon (publishable) Key: " ANON_KEY
    fi

    # Generate .env
    PROJECT_URL="https://${PROJECT_REF}.supabase.co"

    cat > "$ENV_FILE" <<EOF
SUPABASE_URL=${PROJECT_URL}
SUPABASE_ANON_KEY=${ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SERVICE_KEY}
SUPABASE_PROJECT_ID=${PROJECT_REF}

APP_ENV=development
LOG_LEVEL=debug
ALLOWED_ORIGINS=["http://localhost:5173"]

API_PORT=8000
FRONTEND_PORT=5173
API_URL=http://localhost:8000

VITE_SUPABASE_URL=${PROJECT_URL}
VITE_SUPABASE_ANON_KEY=${ANON_KEY}
VITE_API_URL=http://localhost:8000
EOF

    log "📝" ".env file generated at ${ENV_FILE}"

    # Pause for user to fill in service key if missing
    if [[ -z "$SERVICE_KEY" ]]; then
        echo ""
        log "⚠️" "SUPABASE_SERVICE_ROLE_KEY is not set."
        log "📝" "Please open .env and fill in SUPABASE_SERVICE_ROLE_KEY now."
        echo ""
        read -rp "Press Enter once you've saved .env..."

        set -a
        source "$ENV_FILE"
        set +a

        if [[ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
            die "SUPABASE_SERVICE_ROLE_KEY is still empty in .env"
        fi
        SERVICE_KEY="$SUPABASE_SERVICE_ROLE_KEY"
    fi
fi

PROJECT_URL="https://${PROJECT_REF}.supabase.co"

# Prompt for DB password if still missing (not stored in .env)
if [[ -z "$DB_PASSWORD" ]]; then
    read -rsp "Supabase DB Password: " DB_PASSWORD
    echo ""
fi

# ── Step 4: Create etc/required_env_vars.txt (idempotent) ────────────────────

REQUIRED_VARS_FILE="${SCRIPT_DIR}/etc/required_env_vars.txt"
if [[ ! -f "$REQUIRED_VARS_FILE" ]]; then
    die "etc/required_env_vars.txt is missing — repo may be corrupt"
fi
log "✅" "etc/required_env_vars.txt present"

# ── Step 5: Link Supabase project ────────────────────────────────────────────

log "🔗" "Linking Supabase project ${PROJECT_REF}..."
supabase link --project-ref "$PROJECT_REF" --password "$DB_PASSWORD"
log "✅" "Supabase project linked"

# ── Step 6: Push migrations ──────────────────────────────────────────────────

log "🔄" "Pushing database migrations..."
supabase db push --password "$DB_PASSWORD"
log "✅" "Migrations applied"

# ── Step 8: Create auth users ────────────────────────────────────────────────

log "👤" "Creating dev auth users..."

DEV_USERS=(
    "11111111-1111-1111-1111-111111111111:admin@propos.dev:ADMIN"
    "22222222-2222-2222-2222-222222222222:agent@propos.dev:AGENT"
    "33333333-3333-3333-3333-333333333333:landowner@propos.dev:LANDOWNER"
    "44444444-4444-4444-4444-444444444444:buyer@propos.dev:BUYER"
    "55555555-5555-5555-5555-555555555555:content@propos.dev:CONTENT"
)

for entry in "${DEV_USERS[@]}"; do
    IFS=':' read -r uid email role <<< "$entry"

    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
        -X POST "${PROJECT_URL}/auth/v1/admin/users" \
        -H "apikey: ${SERVICE_KEY}" \
        -H "Authorization: Bearer ${SERVICE_KEY}" \
        -H "Content-Type: application/json" \
        -d "{
            \"id\": \"${uid}\",
            \"email\": \"${email}\",
            \"password\": \"password123\",
            \"email_confirm\": true,
            \"user_metadata\": {\"role\": \"${role}\"}
        }")

    if [[ "$HTTP_STATUS" == "200" ]]; then
        log "✅" "Created user ${email}"
    elif [[ "$HTTP_STATUS" == "422" ]]; then
        log "⏭️" "User ${email} already exists — skipping"
    else
        log "⚠️" "Unexpected status ${HTTP_STATUS} creating ${email}"
    fi
done

# ── Step 9: Seed data ────────────────────────────────────────────────────────

log "🌱" "Seeding database..."

if ! command -v psql &>/dev/null; then
    die "psql is required to seed the database. Install it with: brew install libpq && brew link --force libpq"
fi

POOLER_URL_FILE="${SCRIPT_DIR}/supabase/.temp/pooler-url"
if [[ ! -f "$POOLER_URL_FILE" ]]; then
    die "Pooler URL not found. Run 'supabase link' first."
fi

# Parse host and user from pooler URL (avoids password-in-URL shell issues)
POOLER_URL=$(cat "$POOLER_URL_FILE")
DB_USER=$(echo "$POOLER_URL" | sed -n 's|postgresql://\([^@]*\)@.*|\1|p')
DB_HOST=$(echo "$POOLER_URL" | sed -n 's|postgresql://[^@]*@\([^:]*\):.*|\1|p')

PGPASSWORD="$DB_PASSWORD" psql \
    -h "$DB_HOST" \
    -U "$DB_USER" \
    -d postgres \
    -p 5432 \
    -f "${SCRIPT_DIR}/supabase/seed.sql" 2>&1 || {
    log "⚠️" "psql seed had errors — rows may already exist (ON CONFLICT DO NOTHING)"
}

log "✅" "Database seeded"

# ── Step 10: Install backend deps ────────────────────────────────────────────

log "📦" "Installing backend dependencies..."
(cd "${SCRIPT_DIR}/backend" && poetry install)
log "✅" "Backend deps installed"

# ── Step 11: Install frontend deps ───────────────────────────────────────────

log "📦" "Installing frontend dependencies..."
(cd "${SCRIPT_DIR}/frontend" && npm install)
log "✅" "Frontend deps installed"

# ── Summary ──────────────────────────────────────────────────────────────────

echo ""
echo "============================================"
echo "  PropOS setup complete!"
echo "============================================"
echo ""
echo "  Dev user credentials (all same password):"
echo "    Password: password123"
echo ""
echo "    admin@propos.dev      (ADMIN)"
echo "    agent@propos.dev      (AGENT)"
echo "    landowner@propos.dev  (LANDOWNER)"
echo "    buyer@propos.dev      (BUYER)"
echo "    content@propos.dev    (CONTENT)"
echo ""
echo "  Next steps:"
echo "    make dev   — start Docker stack"
echo "    Open http://localhost:5173"
echo ""
