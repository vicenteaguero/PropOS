# PropOS — Claude Code Guide

Multi-tenant real estate operations platform. PWA-first, Spanish UI, dark theme always.

## Stack

- **Frontend**: React 19 + TypeScript + Vite 6 + Tailwind v4 + shadcn/ui + TanStack Query + react-router 7 + vite-plugin-pwa. Path aliases: `@/`, `@shared`, `@features`, `@core`, `@layouts`.
- **Backend**: FastAPI + Poetry + structlog + pydantic-settings + Supabase Python client. Feature pattern: `router.py`, `service.py`, `schemas.py`.
- **DB**: Supabase Postgres (project `tlbkwrjzraaikdrajwqh`, us-east-2). Migrations in `supabase/migrations/` (sequential SQL).
- **Deploy**: GCP Cloud Run (backend), Vercel (frontend). **Two Vercel projects, one per branch**: `main` → `prop-os` (prod, `prop-os-delta.vercel.app`); `dev` → `prop-os-edge` (preview, `prop-os-edge.vercel.app`). Both `.vercel/project.json` (root + frontend) point to the same `prop-os-edge` link locally; pushing the branch is what selects the target project on Vercel's side. Env vars are per-project — keep them in sync (e.g. `VITE_VAPID_PUBLIC_KEY` was missing from prod).

## Repo layout

```
backend/app/{core,features}/      # FastAPI features
frontend/src/{features,shared,layouts,app,core}/
supabase/migrations/              # sequential SQL
_archive/v0-prototype/            # reference patterns from prototype, NOT in build path
docs/{architecture,api,api-conventions,roles,disaster-recovery}.md
```

## Conventions

- **Code English, UI Spanish.** Routes, models, files, comments, log messages, HTTPException `detail=` → English. Sidebar labels, page titles, button text, toasts shown to broker → Spanish. LLM prompts producing Spanish output (Client Agent) stay Spanish.
  - `/admin/client-inbox` not `/admin/inbox-clientes`. `client-inbox-page.tsx` style.
- **Dark theme only.** No light mode.
- **API client**: thin `request()` helper with Supabase auth headers; `useQuery` wraps service functions.
- **Pages must have**: loading skeleton + error-with-retry + empty state.
- **Status badges**: custom className styling, not variant prop.

## Commit style

Format: `<type>(<scope>): :gitmoji: <english lowercase summary>`

Strict rules:
- **1 commit = 1 file.** Never bundle. `git add <file>` then commit, repeat.
- **Subject only, no body.** One line.
- **No `Co-Authored-By` footer.** Never add Claude trailer.
- **English summary**, lowercase.
- Prefixes: `feat`, `fix`, `refactor`, `chore`, `docs`, `build`, `ci`. Pick semantically-matching gitmoji.

Examples:
- `feat(db): :sparkles: add migration to extend contact_type enum values`
- `refactor(projects): :recycle: update project status labels and variants`
- `chore(cleanup): :wastebasket: archive v0 prototype`

## Dev environment

```bash
make dev-pwa-hmr           # backend :8000 + vite :5173 + HTTPS proxy :5443 + iPhone LAN
make dev-pwa-hmr-kapso     # same + cloudflared tunnel for Kapso WhatsApp webhook
make dev-docker-pwa-hmr    # docker variant (api+frontend in containers, host runs HTTPS proxy)
make dev                   # full docker-compose
make dev-frontend          # vite only, plain HTTP
```

iPhone same Wi-Fi → `https://192.168.0.62:5443`. mkcert root CA installed on Mac + iPhone (valid until 2028-07-30). Vite proxies `/api` and `/health` to backend; frontend uses relative URLs (empty `VITE_API_URL`).

Service Worker disabled in dev (`devOptions.enabled = false` in `vite.config.ts`) — broke HMR.

**Project location**: `/Users/vicenteaguero/real-state/PropOS`. Moved out of iCloud Desktop on 2026-05-05 — file-provider made bulk ops (tsc, vite build, rollup) hang. Native tooling now fast: build 5s, lint 1.7s, ruff 1.8s. Backend Poetry venv at `~/Library/Caches/pypoetry/virtualenvs/propos-backend-F68E3XRv-py3.12`.

`frontend/src/shared/lib/` is gitignored by `lib/` pattern — `chart-config.ts` must be manually preserved.

## Lint / format / test

```bash
make lint                  # ruff check + ruff format --check + eslint + prettier --check
make format                # ruff --fix + ruff format + eslint --fix + prettier --write
make test                  # pytest + npm test  ⚠️ frontend has no `test` script yet
cd backend && poetry run pytest --no-cov -q
cd frontend && npm run typecheck
cd frontend && npm run build
```

## Notebooks (Jupyter MCP)

Análisis exploratorio vive en `notebooks/`. Claude Code corre celdas + ve outputs (incl. matplotlib PNGs, DataFrames) via Jupyter MCP server.

Setup:
1. Arrancar Jupyter: `make jupyter` (puerto 8888, token `propos-dev`, root = `./notebooks`). Mantener corriendo.
2. `.mcp.json` ya configurado → al abrir Claude Code en el repo, MCP `jupyter` aparece. `/mcp` para verificar.
3. Crear o abrir `.ipynb` en `notebooks/`. Pedir a Claude algo como "abre `scratch.ipynb`, agrega celda que plotee X, ejecuta".

Tools MCP disponibles (no `NotebookEdit` — esa NO ejecuta kernel):
- `list_notebooks`, `read_notebook`, `read_cell`, `append_markdown_cell`, `append_execute_code_cell`, `execute_cell`, `insert_cell`, `overwrite_cell_source`, `delete_cell`, `restart_kernel`.

Workflow recomendado: append celda → execute → leer output (Claude ve PNG inline) → ajustar. No editar `.ipynb` manualmente con `Write`/`Edit`; corrompe JSON. Usar tools MCP.

Notebook smoke test: `notebooks/scratch.ipynb`. Borrar cuando agregues análisis reales.

Datos: para Supabase, `pd.read_sql(...)` contra pooler URL (no commitear credenciales — leer de env). Para datos locales/sintéticos no hace falta DB.

## DB

```bash
make query SQL="..."       # read-only via backend/scripts/db_query.py + pooler
make query-write SQL="..." # mutations
make migrate               # supabase db push via percent-encoded pooler URL
```

Schema gotchas:
- No `users` table. Use `profiles` (auth users) or `people` (CRM contacts).
- `properties` has no `owner_id`. Closest direct link is `properties.created_by → profiles.id`. Ownership via `interaction_participants` joined through `interaction_targets.property_id`.

**Migrate gotcha**: Makefile `include .env` interpolates `$X` sequences. Password like `4@KsZWY$msrKJ*G` becomes `4@KsZWYsrKJ*G` after Make eats `$m`. Recipe sources `.env` via shell + percent-encodes via Python. Don't mention VPN — wrong guidance.

Supabase CLI v2.75.0 specifics:
- `[project]` section in `config.toml` is INVALID (parse error). Project ID set via `supabase link` only.
- `supabase db url` doesn't exist.
- `supabase db reset --linked` doesn't accept `--password`.
- `supabase db reset` truncates `auth.users` — never use as seed fallback after creating auth users.
- Direct host `db.<ref>.supabase.co` doesn't resolve. Use `supabase/.temp/pooler-url`.
- Use `PGPASSWORD` env var, not URL-embedded password (special chars).

Auth Admin API: `POST <project-url>/auth/v1/admin/users` needs `apikey: <service_role_key>` (NOT anon → 403) + `Authorization: Bearer <service_role_key>`. 422 if user exists (idempotent).

UUIDs: hex only (0-9, a-f). `pppp` invalid, use `dddd`.

## Features status

### Agent / "Propo" (AI assistant) — shipped, lives in `backend/app/features/agent/`

The assistant was renamed **anita → agent** (migration `20240601000011`); code, tables (`agent_sessions`/`agent_messages`/`agent_transcripts`), and routes use `agent`. The product PDF calls it "Propo", the `tenants.settings.ai_assistant_name` default is "Anita" — all the same assistant. Admin-only (router gated `require_role("ADMIN")` + `require_scope("agent")`).

- **Architecture is a classifier pipeline, NOT native tool-calling.** Flow: `classifier` (single LLM call → KV intent) → `resolver` (local rapidfuzz entity match, zero LLM) → `dispatcher` (deterministic branch). Files: `agent/{classifier,resolver,dispatcher,intent_registry,chat}.py`. There is **no** `llm.py` Protocol and **no** `tools/definitions.py` — adding a capability = new `IntentSpec` in `intent_registry.py` + classifier prompt example + dispatcher branch + `_accept_*` in `tools/executors.py` + `ACCEPTOR_BY_KIND`.
- **Provider is Groq-only** (`https://api.groq.com/openai/v1`, hardcoded in `classifier.py`/`tools/text_to_sql.py`/`transcribe.py`). `settings.agent_provider` only selects the rate-limit window. The Cerebras-dev / Anthropic-prod swap is **not** implemented (deferred post-v0.1.0).
- **Audio**: MediaRecorder (frontend) → server-side Groq Whisper (`agent/transcribe.py`). No Web Speech API. Audio persisted to `media_files`.
- **Mutation flow**: propose → `pending_proposals` → accept/reject; low-stakes intents `auto_commit=True` write directly. Accept handler in `pending/service.py` stamps audit via PostgREST headers `X-Agent-Session-Id` + `X-Action-Source='agent'` (the universal audit trigger reads `app.action_source`). Read path: `query_data` (whitelisted views) + `text_to_sql` (sqlglot-guarded SELECT via `agent_readonly` role).
- **UI**: inline `<AgentInlineProposalCard>` (accept/edit/reject in chat) + `<ProposalDisambiguationPicker>` when `pending_proposals.ambiguity[<field>].candidates.length >= 2`.
- **Pages**: `/admin/agent`, `/admin/analytics`, `/admin/analytics/agent-cost`, `/<role>/timeline/:table/:id`, `/<role>/workflows`.

### Kapso/WhatsApp channel — shipped 2026-05-03

Bidirectional WhatsApp via Kapso BSP (chosen over Twilio/360dialog for cost + AI agent flexibility). Kapso Proxy provisions number, HMAC-SHA256 webhooks, REST send API.

Two flows share one number:
- Internal user (broker phone in `user_phones`) → existing agent pipeline (`agent_sessions.source='whatsapp'`, driven via `channels/agent_adapter.py` → `run_chat_turn`, bypassing the gated agent router).
- External contact → new Client Agent (B2C) using `client_conversations` / `client_messages`.

Critical files:
- `backend/app/features/integrations/kapso/{client,signature,webhook}.py`
- `backend/app/features/channels/{router,agent_adapter,client_agent,router_api}.py`
- `backend/app/features/notifications/whatsapp/{templates,dispatcher}.py`
- `frontend/src/features/client-chat/`
- Migration `20240601000003_kapso_channels.sql`

Compliance: opt-in required (hard-blocked in dispatcher), 24h freeform window enforced, Meta template approval required (`make kapso-templates-sync`). Don't bypass `client_consents` table. New outbound flows route through `notifications.service.notify_contact_whatsapp` (fans to dispatcher with consent gate). New inbound channels extend `channels/router.py`.

### Baseline post-v0 cleanup (2026-04-30)

V0 prototype features (`properties`, `contacts`, `projects`, `chat`, `documents`, `admin`, `settings`, `test-lab`) and DB tables wiped. App ships baseline shell. Surviving infra (push notifications, users, shared media/sensor hooks) marked `// TODO: producción — refactor` because built during prototyping. Audit before exposing in real feature.

`_archive/v0-prototype/` keeps reference patterns: kanban with @dnd-kit, photo lightbox via yet-another-react-lightbox, Supabase realtime conversations, document viewer, interactions timeline, 6 archived migrations. Reference only — rewrite for production quality, don't drop in as-is.

Sidebar nav (`frontend/src/layouts/app-sidebar.tsx` `NAV_ITEMS_BY_ROLE`) and router (`frontend/src/app/router.tsx`) are placeholder shells per role; new feature adds entries.

## Disaster recovery

`docs/disaster-recovery.md` — soft delete restore, audit-log replay, PITR, pre-incident checklist.

## Caveman mode

User runs `/caveman` skill (full mode). Chat replies = terse fragments, drop articles/filler/pleasantries/hedging. Code, commits, PR bodies, security warnings → normal prose. `stop caveman` or `normal mode` reverts.
