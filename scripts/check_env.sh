#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REQUIRED_VARS_FILE="${SCRIPT_DIR}/etc/required_env_vars.txt"
LOG_SCRIPT="${SCRIPT_DIR}/scripts/log.sh"
ENV_FILE="${SCRIPT_DIR}/.env"

# Load .env into the environment
if [ -f "$ENV_FILE" ]; then
    set -a
    source "$ENV_FILE"
    set +a
fi

MISSING=0

while IFS= read -r VAR_NAME; do
    if [ -z "${!VAR_NAME:-}" ]; then
        bash "${LOG_SCRIPT}" ENV "❌" "Missing required env var: ${VAR_NAME}"
        MISSING=1
    fi
done < "${REQUIRED_VARS_FILE}"

if [ "${MISSING}" -eq 1 ]; then
    bash "${LOG_SCRIPT}" ENV "❌" "Environment check failed — missing required variables"
    exit 1
fi

bash "${LOG_SCRIPT}" ENV "✅" "All required environment variables are set"
