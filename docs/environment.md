# Environment variables

Backend configuration is a single pydantic-settings model,
`backend/app/core/config/settings.py`, with **46 fields**. Everything else the
repo reads from the environment is either a test knob or tooling, and is listed
at the bottom.

## How a value reaches the backend

```
.env  ──scripts/sync_cloud_env.sh──▶  Secret Manager   ──cloudbuild --set-secrets──▶  Cloud Run
  │                              └─▶  cloudrun-env.yaml ──cloudbuild --env-vars-file──▶ Cloud Run
  └──pydantic-settings (env_file=".env")──▶ local backend
```

`.env` is the single source of truth locally and the input to
`make deploy-secrets-sync`. `Settings` reads it directly in development
(`model_config = SettingsConfigDict(env_file=".env", extra="ignore")`).

For production, `scripts/sync_cloud_env.sh` splits keys into three lists:

- **`SECRETS`** — pushed to GCP Secret Manager as `lower-kebab-case` names.
  `config/docker/cloudbuild.yaml:60-86` mounts only the secrets that exist; an
  unprovisioned one is skipped, not fatal.
- **`NON_SECRETS`** — written into `config/docker/cloudrun-env.yaml`, which is
  committed and applied with `--env-vars-file` (`cloudbuild.yaml:99`).
- **`LOCAL_ONLY`** — deliberately never sent to Cloud Run.

`--env-vars-file` **replaces** the service's entire env var set on every deploy.
A variable set by hand with `gcloud run services update` survives exactly until
the next build.

## Two traps

**1. Six settings fields are in none of the three lists.**

`AGENT_SESSION_INACTIVITY_HOURS`, `AGENT_TURNS_PER_USER_PER_DAY`,
`AI_PROCESSING_ENABLED`, `RETENTION_WEBHOOK_EVENTS_DAYS`,
`RETENTION_AGENT_TRANSCRIPTS_DAYS` and `RETENTION_AUDIT_LOG_DAYS` are read by
the backend but never transported, so **in production they are pinned to their
code defaults** and cannot be changed without editing `sync_cloud_env.sh`.
`AI_PROCESSING_ENABLED` is the Ley 21.719 kill switch for the AI sub-processor
(`backend/app/core/ai_guard.py`); it is not operable in production until it is
added to `NON_SECRETS`.

The drift check at `sync_cloud_env.sh:168-193` catches this class of bug, but
only warns for keys that are *already present in `.env`*; a field that nobody
has set locally slips through silently.

**2. `etc/.env.example` still ships a retired `ANITA_*` key.**

`settings.py:96-109` refuses to boot when any `ANITA_*` variable is set in the
process environment — the vars were renamed `ANITA_* → AGENT_*` and
`extra="ignore"` would otherwise drop them silently. `etc/.env.example:33` still
contains `ANITA_STT_ENABLED=true`. Loading `.env` through pydantic alone does
not trip the guard, but anything that exports the file into the environment does
— `docker-compose.yml:8,19` (`env_file: .env`), and the `make` targets that run
`set -a && . ./.env` (`Makefile:115`). Copying the example verbatim and running
`make dev` produces:

```
RuntimeError: Retired env vars still set: ANITA_STT_ENABLED.
```

Delete that line from your `.env`. `ANITA_STT_ENABLED` and
`WHATSAPP_BROADCAST_ENABLED` are both read by **no code at all**; the working
kill switch is `AI_PROCESSING_ENABLED`.

## Settings fields

`—(required)` means the backend refuses to start without it.

| Variable | Type | Default | Where it goes in production |
|---|---|---|---|
| `SUPABASE_URL` | str | —(required) | Secret Manager |
| `SUPABASE_ANON_KEY` | str | —(required) | Secret Manager |
| `SUPABASE_SERVICE_ROLE_KEY` | str | —(required) | Secret Manager |
| `APP_ENV` | str | `development` | `cloudrun-env.yaml` |
| `LOG_LEVEL` | str | `debug` | `cloudrun-env.yaml` |
| `ALLOWED_ORIGINS` | list | `['http://localhost:5173', 'https://prop-os-delta.vercel.app']` | `cloudrun-env.yaml` |
| `VAPID_PRIVATE_KEY` | str | `""` | Secret Manager |
| `VAPID_PUBLIC_KEY` | str | `""` | Secret Manager |
| `VAPID_CONTACT_EMAIL` | str | `admin@propos.app` | `cloudrun-env.yaml` |
| `AGENT_PROVIDER` | str | `groq` | `cloudrun-env.yaml` |
| `AGENT_MODEL` | str | `llama-3.3-70b-versatile` | `cloudrun-env.yaml` |
| `AGENT_FALLBACK_PROVIDER` | str | `groq` | `cloudrun-env.yaml` |
| `CEREBRAS_API_KEY` | str | `""` | Secret Manager |
| `ANTHROPIC_API_KEY` | str | `""` | Secret Manager |
| `GROQ_API_KEY` | str | `""` | Secret Manager |
| `OPENAI_API_KEY` | str | `""` | Secret Manager |
| `AGENT_TRANSCRIBE_PROVIDER` | str | `groq` | `cloudrun-env.yaml` |
| `AGENT_DAILY_BUDGET_USD` | float | `0.5` | `cloudrun-env.yaml` |
| `AGENT_MAX_TOOL_CALLS_PER_TURN` | int | `8` | `cloudrun-env.yaml` |
| `AGENT_TURN_TIMEOUT_SECONDS` | int | `45` | `cloudrun-env.yaml` |
| `AGENT_STRICT_JSON_RETRY` | int | `2` | `cloudrun-env.yaml` |
| `AGENT_SESSION_INACTIVITY_HOURS` | int | `4` | **not transported** |
| `AGENT_TURNS_PER_USER_PER_DAY` | int | `50` | **not transported** |
| `AI_PROCESSING_ENABLED` | bool | `True` | **not transported** |
| `RETENTION_WEBHOOK_EVENTS_DAYS` | int | `60` | **not transported** |
| `RETENTION_AGENT_TRANSCRIPTS_DAYS` | int | `90` | **not transported** |
| `RETENTION_AUDIT_LOG_DAYS` | int | `1825` | **not transported** |
| `KAPSO_API_KEY` | str | `""` | Secret Manager |
| `KAPSO_WEBHOOK_SECRET` | str | `""` | Secret Manager |
| `KAPSO_PHONE_NUMBER_ID` | str | `""` | Secret Manager |
| `KAPSO_BASE_URL` | str | `https://api.kapso.ai/meta/whatsapp/v18.0` | `cloudrun-env.yaml` |
| `KAPSO_DEFAULT_TEMPLATE_LANG` | str | `es` | `cloudrun-env.yaml` |
| `CLIENT_AGENT_PROVIDER` | str | `groq` | `cloudrun-env.yaml` |
| `CLIENT_AGENT_MODEL` | str | `llama-3.3-70b-versatile` | `cloudrun-env.yaml` |
| `CLIENT_AGENT_MAX_HISTORY` | int | `12` | `cloudrun-env.yaml` |
| `CLIENT_AGENT_BUSINESS_NAME` | str | `PropOS` | `cloudrun-env.yaml` |
| `RESEND_API_KEY` | str | `""` | Secret Manager |
| `RESEND_FROM_EMAIL` | str | `PropOS <no-reply@propos.dev>` | `cloudrun-env.yaml` |
| `APP_BASE_URL` | str | `https://prop-os-delta.vercel.app` | `cloudrun-env.yaml` |
| `INTERNAL_JOBS_SECRET` | str | `""` | Secret Manager |
| `EMAIL_SYNC_ENABLED` | bool | `False` | `cloudrun-env.yaml` |
| `EMAIL_IMAP_HOST` | str | `imap.titan.email` | local only |
| `EMAIL_IMAP_PORT` | int | `993` | local only |
| `EMAIL_IMAP_USER` | str | `""` | Secret Manager |
| `EMAIL_IMAP_PASSWORD` | str | `""` | Secret Manager |
| `EMAIL_SYNC_TENANT_ID` | str | `""` | `cloudrun-env.yaml` |
## Read from the environment, but not `Settings` fields

| Variable | Read at | Purpose |
|---|---|---|
| `AGENT_READONLY_DB_URL` | `agent/tools/query_sql.py:34` | psycopg URL for the `agent_readonly` role. In `SECRETS`, so it does reach Cloud Run. Unset ⇒ `text_to_sql` returns `readonly_role_not_configured`. |
| `SUPABASE_DB_SCHEMA` | `core/supabase/client.py:21` | Routes every PostgREST call to a schema. Default `public`; the integration suite sets `propos_test`. |
| `AGENT_TEST_SCHEMA` | `tests/integration/agent/conftest.py:132` | Overrides the test schema name. Default `propos_test`. |
| `AGENT_TEST_FULL` | `tests/integration/agent/conftest.py:197` | Widens the agent provider matrix. |
| `SKIP_SECRETS` | `scripts/sync_cloud_env.sh:120` | `=1` regenerates `cloudrun-env.yaml` without touching Secret Manager. |

## Tooling keys in `.env` (never read by the backend)

| Variable | Used by |
|---|---|
| `SUPABASE_DB_PASSWORD` | `make migrate`, `backend/scripts/db_query.py`, `pg_dump` (see `docs/disaster-recovery.md`) |
| `SUPABASE_PROJECT_ID` | Supabase CLI linking |
| `GCP_PROJECT_ID`, `GCP_REGION` | deploy targets in the `Makefile` |
| `API_PORT`, `FRONTEND_PORT`, `API_URL` | `docker-compose.yml`, dev scripts |

## Frontend (`VITE_*`)

Vite inlines these at build time, so they are **public**. Only the anon key
belongs here — never a service-role key. Read through
`frontend/src/core/config/env.ts`:

| Variable | Notes |
|---|---|
| `VITE_SUPABASE_URL` | required |
| `VITE_SUPABASE_ANON_KEY` | required |
| `VITE_API_URL` | empty in dev — Vite proxies `/api` and `/health` to `:8000` |
| `VITE_VAPID_PUBLIC_KEY` | web-push subscription; defaults to `""` |

These live in the Vercel project settings, and there are **two projects** —
`prop-os` (branch `main`) and `prop-os-edge` (branch `dev`). Their variables are
independent; a key added to one is not present in the other.

## Commands

```bash
cp etc/.env.example .env          # then delete the ANITA_STT_ENABLED line
make deploy-secrets-sync          # push SECRETS + regenerate cloudrun-env.yaml
SKIP_SECRETS=1 bash scripts/sync_cloud_env.sh   # regenerate the yaml only
bash scripts/check_env.sh         # checks etc/required_env_vars.txt (also run by `make setup`)
```

See `docs/deployment.md` for what happens after the sync, and
`docs/testing.md` for the test-only variables.
