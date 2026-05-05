# PropOS — Claude Code Guide

Multi-tenant real estate operations platform. PWA-first, Spanish UI, dark theme always.

## Stack

- **Frontend**: React 19 + TypeScript + Vite 6 + Tailwind v4 + shadcn/ui + TanStack Query + react-router 7 + vite-plugin-pwa. Path aliases: `@/`, `@shared`, `@features`, `@core`, `@layouts`.
- **Backend**: FastAPI + Poetry + structlog + pydantic-settings + Supabase Python client. Feature pattern: `router.py`, `service.py`, `schemas.py`.
- **DB**: Supabase Postgres (project `tlbkwrjzraaikdrajwqh`, us-east-2). Migrations in `supabase/migrations/` (sequential SQL).
- **Deploy**: GCP Cloud Run (backend), Vercel (frontend).

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

### Anita (AI assistant) — complete 2026-05-01

End-to-end shipped. All 15 migrations 0020-0034 applied. Frontend `tsc --noEmit` exit 0.

- **Provider** abstracted via `LLMClient` Protocol (`backend/app/features/anita/llm.py`). Switch by env `ANITA_PROVIDER`.
  - DEV: Cerebras free (Llama 3.3 70B, 1M tok/día, 30 req/min, OpenAI-compatible). Fallback: Groq `llama-3.3-70b-versatile`.
  - PROD: Anthropic Claude Sonnet 4.6 (~98% tool use vs Llama ~85%).
  - Claude OAuth tokens (`sk-ant-oat01-`) only work with `claude` CLI, NOT Messages API/Agent SDK. ToS violation in third-party apps.
- **Audio**: Web Speech API browser-native primary (free, es-CL). Groq Whisper free tier server-side fallback. Audio blob always persisted to `media_files`.
- **Mutation flow**: propose → `pending_proposals` → accept/reject. Never write directly to domain tables from AI tool calls. Read-only tools (`find_*`, `query_data`, `clarify`) hit live data. Accept handler in `backend/app/features/pending/service.py` runs target service in transaction with `SET LOCAL app.anita_session_id = ?` + `SET LOCAL app.action_source = 'anita'` so universal audit trigger stamps `source='anita'`.
- **Tool definitions** canonical in `tools/definitions.py`; `llm.py` adapters translate to provider format (OpenAI tool format for Cerebras/Groq/OpenAI; Anthropic native).
- **UI**: inline `<AnitaInlineProposalCard>` in chat (accept/edit/reject without leaving chat). `<ProposalDisambiguationPicker>` shown when `pending_proposals.ambiguity[<field>].candidates.length >= 2`.
- **Pages**: `/admin/analytics`, `/admin/analytics/anita-cost`, `/<role>/timeline/:table/:id` (renders `v_entity_timeline`), `/<role>/workflows`.
- **Pending user actions** (not code): real `CEREBRAS_API_KEY` + `GROQ_API_KEY` in `.env`; 50-phrase test suite for Llama tool use quality.

### Kapso/WhatsApp channel — shipped 2026-05-03

Bidirectional WhatsApp via Kapso BSP (chosen over Twilio/360dialog for cost + AI agent flexibility). Kapso Proxy provisions number, HMAC-SHA256 webhooks, REST send API.

Two flows share one number:
- Internal user (broker phone in `user_phones`) → existing Anita pipeline (`anita_sessions.source='whatsapp'`).
- External contact → new Client Agent (B2C) using `client_conversations` / `client_messages`.

Critical files:
- `backend/app/features/integrations/kapso/{client,signature,webhook}.py`
- `backend/app/features/channels/{router,anita_adapter,client_agent,router_api}.py`
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
