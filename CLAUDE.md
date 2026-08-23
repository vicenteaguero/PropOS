# PropOS — Claude Code Guide

Multi-tenant real estate operations platform. PWA-first, Spanish UI, dark theme by default (light available).

> ⚠️ **This repo is PUBLIC** (`github.com/vicenteaguero/PropOS`) while the deployment is live. Never commit `.env`, service-role keys, mailbox credentials, customer data, or security findings that are still unpatched. Gitignored on purpose: `docs/audits/*`, `docs/research/`, `docs/internal*/`, `docs/versions/*.pdf`, `notebooks/`, `backend/notebooks/`, `data/`, `.mcp.json`.

**First real users**: 2026-08-23 — Jaime and Ana on their phones, in the
`ANAIDA` tenant, which was emptied of test data (`make query` shows zero rows
outside the catalogs). Accounts are created by
`backend/scripts/seed_anaida_users.py` with a temporary password and
`profiles.must_change_password = true`, which `ProtectedRoute` enforces before
any route renders. Self-signup is **off** (`disable_signup`), the auth email
rate limit is 30/h (was 2) and the password floor is 8. The mailboxes on
`anaida.cl` do not exist yet — the domain is verified in Resend for *sending*
only — so a forgotten password is reset by an admin, not by email, until a
mail provider is bought.

**Current state**: the R3 audit (2026-08-16) and its full remediation (2026-08-18) are done — 123 of 124 findings closed and re-verified against the live system, plus three defects the audit had missed. Production is on: 13 secrets mounted, two Cloud Scheduler jobs running, outbound email verified, free-form analytics returning rows. See `docs/audits/v0.1.0-r3/R3-CLOSURE.md` for what changed and `docs/versions/v0.1.0.md` for per-feature status. Re-run the verification any time with `cd backend && poetry run python -m scripts.audit_r3_verify`.

Two things are deliberately still off: **Titan/IMAP email-sync** (owner's call — delicate production mailbox, `EMAIL_SYNC_ENABLED=false`, no credentials provisioned) and **WhatsApp inbound**, which needs the webhook URL pasted into the Kapso dashboard — there is no API for it.

## Stack

- **Frontend**: React 19 + TypeScript + Vite 6 + Tailwind v4 + shadcn/ui + TanStack Query + react-router 7 + vite-plugin-pwa. Path aliases: `@/`, `@shared`, `@features`, `@core`, `@layouts`.
- **Backend**: FastAPI + Poetry + structlog + pydantic-settings + Supabase Python client. Feature pattern: `router.py`, `service.py`, `schemas.py`.
- **DB**: Supabase Postgres (project `tlbkwrjzraaikdrajwqh`, us-east-2). Migrations in `supabase/migrations/` (sequential SQL).
- **Deploy**: GCP Cloud Run (backend), Vercel (frontend). Full matrix, secrets inventory and rollback in `docs/deployment.md`. Short version: `main` → `prop-os` (prod), `dev` → `prop-os-edge` (staging), and **staging is frontend-only** — both branches share one Cloud Run service and one Supabase schema (`public`). Env vars are per-Vercel-project and baked at build time.

**Branch flow**: work on `dev` → verify on `prop-os-edge` → merge to `main` = production. Backend or DB changes reach production regardless of branch, so treat those as production changes wherever they land.

## Repo layout

```
backend/app/{core,features}/      # FastAPI features
frontend/src/{features,shared,layouts,app,core}/
supabase/migrations/              # sequential SQL
_archive/v0-prototype/            # reference patterns from prototype, NOT in build path
docs/{architecture,api,api-conventions,roles,disaster-recovery}.md
```

## Conventions

- **Code English, UI Spanish.** Models, files, components, comments, log messages, HTTPException
  `detail=` → English. Sidebar labels, page titles, button text, toasts shown to broker → Spanish.
  LLM prompts producing Spanish output (Client Agent) stay Spanish.
  - `client-inbox-page.tsx` style for filenames; `ContactService`, `build_feed` for identifiers.
  - **Routes are Spanish.** They are surface the broker reads and shares, so they follow the UI
    rule, not the code rule: `/admin/clientes`, `/admin/personas/:id`, `/admin/propiedades/:id`.
    This used to say English, and the code had already voted the other way — `documentos` and
    `documents` both existed as routes, as did `personas` and `properties`. English paths remain as
    `<Navigate>` redirects, listed in `frontend/src/app/legacy-routes.ts`; never delete one.
- **Light + dark; default dark.** `<html class="dark">` is the static default (set in `index.html`); the toggle (`@core/theme/theme.ts` + `ThemeProvider`) only removes `.dark` for light. Light palette lives in `:root`, dark in `.dark` (see `src/index.css`).
- **Tenant-driven accent.** The active workspace drives the brand accent via a hue injected on `<html>` by `ThemeController` (`@core/theme/tenant-accent.ts`); `--primary`/`--ring`/`--sidebar-primary` derive from it. The `[data-palette]` switcher (`PaletteSwitcher`) is now **dev-only**.
- **New design kit** in `src/shared/ui/` (Pill, Chips, Segmented, Row, BottomSheet, RoundButton, WorkspacePill, brand marks) — keep shadcn's `src/components/ui/` regenerable. Mobile broker shell = floating bottom-nav + center Propo FAB (`mobile-bottom-nav.tsx`, chosen by `useShellMode`); desktop/other roles = restyled sidebar.
- **API client**: thin `request()` helper with Supabase auth headers; `useQuery` wraps service functions.
- **Pages must have**: loading skeleton + error-with-retry + empty state.
- **Status badges**: custom className styling, not variant prop.

## Commit style

Format: `<type>(<scope>): :gitmoji: <english lowercase summary>`

Strict rules:
- **1 commit = 1 change.** One finding, one bug, one surface — not one file. A change that needs a
  migration plus the code that makes it work belongs in a single commit, because either half alone is
  broken. When the work traces to an audit finding, put the id in the subject: `[P1-07]`.
  (This replaces the older one-file-per-commit rule, which split coupled changes into commits that
  could not be reviewed or reverted on their own.)
- **Subject only, no body.** One line.
- **No `Co-Authored-By` footer.** Never add Claude trailer.
- **English summary**, lowercase.
- Prefixes: `feat`, `fix`, `refactor`, `chore`, `docs`, `build`, `ci`. Pick semantically-matching gitmoji.

Examples:
- `feat(db): :sparkles: add migration to extend contact_type enum values`
- `fix(agent): :lock: scope agent_readonly to exposed tables and set tenant guc [P1-07]`
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

`.gitignore` ignores `lib/` but negates the three source paths (`frontend/src/lib/`, `frontend/src/shared/lib/`, `frontend/src/features/**/lib/`), so nothing under `frontend/src` is ignored. Verify with `git status --ignored -s frontend/src` — it must print nothing.

## Lint / format / test

```bash
make lint                  # ruff check + ruff format --check + eslint + prettier --check
make format                # ruff --fix + ruff format + eslint --fix + prettier --write
make test                  # pytest (200 unit) + npm test (`vitest run` — 1 file, 3 tests)
cd backend && poetry run pytest --no-cov -q
cd frontend && npm run typecheck
cd frontend && npm run build
```

## Notebooks (Jupyter MCP)

Análisis exploratorio vive en `notebooks/` (raíz) y `backend/notebooks/`. **Ambos directorios están gitignored** — contienen datos reales (exports de casillas Titan, planillas de propiedades) y el repo es público. Claude Code corre celdas + ve outputs (incl. matplotlib PNGs, DataFrames) via Jupyter MCP server.

Setup:
1. Arrancar Jupyter: `make jupyter` (puerto 8888, token `propos-dev`, root = `./notebooks`). Mantener corriendo.
2. `.mcp.json` es local (gitignored, ruta del venv es por máquina). Copiar de `.mcp.json.example` y reemplazar `<VENV>` por `poetry env info --path`. Al abrir Claude Code en el repo, MCP `jupyter` aparece; `/mcp` para verificar.
3. Crear o abrir `.ipynb` en `notebooks/`. Pedir a Claude algo como "abre `scratch.ipynb`, agrega celda que plotee X, ejecuta".

Tools MCP disponibles (no `NotebookEdit` — esa NO ejecuta kernel):
- `list_notebooks`, `read_notebook`, `read_cell`, `append_markdown_cell`, `append_execute_code_cell`, `execute_cell`, `insert_cell`, `overwrite_cell_source`, `delete_cell`, `restart_kernel`.

Workflow recomendado: append celda → execute → leer output (Claude ve PNG inline) → ajustar. No editar `.ipynb` manualmente con `Write`/`Edit`; corrompe JSON. Usar tools MCP.

Notebook smoke test: `notebooks/scratch.ipynb`. Borrar cuando agregues análisis reales.

Datos: para Supabase, `pd.read_sql(...)` contra pooler URL (no commitear credenciales — leer de env). Para datos locales/sintéticos no hace falta DB.

## DB

Nota de entorno (2026-08-16): el venv de Poetry se había perdido y `make query`/`make lint` fallaban. Reconstruido con `cd backend && poetry env use python3.12 && poetry install` (Poetry 2.4.1, venv en `~/Library/Caches/pypoetry/virtualenvs/propos-backend-F68E3XRv-py3.12`). Si vuelven a fallar, ese es el arreglo — no es un bug del Makefile.

```bash
make query SQL="..."       # read-only via backend/scripts/db_query.py + pooler
make query-write SQL="..." # mutations
make seed-demo             # large `PropOS Demo` tenant (WIPE=1 to rebuild)
make seed-demo-wipe        # remove it again
make migrate               # supabase db push via percent-encoded pooler URL
make scale-up / scale-down / scale-status   # Cloud Run instance floor
```

**Emptying a tenant.** `poetry run python -m scripts.reset_tenant_data <uuid>`
prints what it would delete; `CONFIRM=1` performs it. It walks every base table
carrying `tenant_id`, retrying the ones a foreign key blocks until a pass makes
no progress, and sweeps the tenant's objects out of the `media` and `documents`
buckets. It protects identity and the configurable catalogs (templates,
checklists, pipelines, tags, internal areas, feature states) and keeps
`audit_log` unless `--with-audit` is passed — the ledger is what
`docs/disaster-recovery.md` replays.

**Demo data.** `make seed-demo` builds the `PropOS Demo` tenant
(`dededede-0000-4000-8000-000000000001`) — ~250 personas, 40 propiedades con fotos reales en
Storage, 120 oportunidades, 800 interacciones, 300 tareas/eventos (incluidos eventos de hoy),
150 conversaciones de WhatsApp, 400 transacciones. **Vive en `public`, la misma base que
producción**: lo único que lo separa de datos reales es el `tenant_id`, y ese guard está en
`backend/scripts/seed_demo/context.py:assert_safe_to_write`. No lo relajes. El slug vive en el
enum `tenant_slug` (migración `...0055`), así que la etiqueta es permanente aunque borres las
filas.

**Schema toggle en dev.** El header `X-Db-Schema` cambia el schema por request; el middleware
(`backend/app/core/middleware/dev_schema.py`) sólo se instala con `APP_ENV=development`. El
switch está en Configuración → Desarrollo (sólo en builds dev). Ojo: `propos_test` no tiene
`profiles` ni RLS, sirve para probar el backend, no para navegar la app.

**Un solo proyecto Supabase.** `public` es producción. `propos_test` es el schema espejo que usa la suite de integración; se regenera desde la estructura viva con `make test-schema-rebuild` (`make test-schema-rebuild DRY=1` imprime el SQL sin ejecutar). No se mantiene a mano: la migración `...0002` lo dejó congelado en 28 tablas mientras `public` llegaba a 59. El fixture de integración aborta si PostgREST no expone `propos_test`, en vez de caer a `public`.

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
- **Audio**: MediaRecorder (frontend) → server-side Groq Whisper (`agent/transcribe.py`). No Web Speech API. Only the transcript is stored — the audio blob is **not** persisted to `media_files` (`agent/router.py:296-305`), despite older docs saying otherwise.
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

Nav lives in `frontend/src/layouts/nav-items.ts` (`buildGroups`), consumed by BOTH shells
(desktop sidebar + mobile "Más" sheet) — edit it once, both update.

**Information architecture (2026-08-20).** The app is four sections plus Inicio, not a route
per noun. Each section hosts the former list pages as tabs via `shared/ui/section-tabs.tsx`,
with the active tab in a `?tab=` query param:

| Section | Route | Tabs |
|---|---|---|
| Clientes | `/:role/clientes` | Conversaciones · Personas · Negocios · Propiedades |
| Agenda | `/:role/agenda` | Calendario · Tareas · Notas |
| Finanzas | `/:role/finanzas` | Movimientos · Analítica · Costo Propo (dev admin) |
| Documentos | `/:role/documentos` | Archivos · Enlaces |

Detail routes keep their original paths (`/:role/personas/:id`, `/:role/propiedades/:id`,
`/:role/negocios/:id`, `/:role/documents/:id`); the old LIST paths are `<Navigate>` redirects into
the right tab, so saved links and push-notification deep links still land. A new capability should
become a tab, not a fifth section.

The catalogs behind Clientes live at `/admin/settings/clientes` (ADMIN only), same tab pattern:
**Plantillas** (`message_templates`) · **Listas de cierre** (`checklist_templates`) · **Pipelines**
(`pipelines` + `pipeline_transitions`) · **Etiquetas** (`tags`). Two behaviours there are
surprising and are surfaced on the screen on purpose: `pipeline_transitions.from_stage = NULL`
means "from any stage", and a pipeline with **zero** declared transitions is unconstrained —
`assert_allowed` returns early rather than freezing a tenant that never configured one, so deleting
the last transition silently turns the state machine off.

Design rules that came out of the same pass: no page subtitles and no explanatory copy
(`PageHeader` has no `description` slot on purpose), `--radius` is **0.375rem = 6px**
(`index.css:275`; this doc said 8px for months and it was simply wrong) with every radius going
through a token, and the page gutter is `--page-x` on the container — never `px-5` repeated per
section.

### UI lessons

Every row here is a mistake that shipped, found by using the product on a phone. They are listed
with the failure that produced them because the rule on its own is forgettable and the failure is
not.

| Lesson | The failure that produced it |
|---|---|
| A placeholder, not a label above every field. Eight labelled rows are twice the height of the same form without them, and height is the scarce axis on a phone. | the event and task modals |
| **Compact into one row when two controls fit.** A control per row turns a form into a scroll. | four filters in two rows in Tareas; Crear and Cancelar as two stacked full-width buttons |
| **No silent overflow.** A scrollable strip that overflows by 20px has no room to signal it — the fix is to make it fit (a grid), not to fade the edge. | the calendar's four filter chips at 360px; the edge fade on `TabBar`, which read as a rendering fault |
| **Vertical alignment is `items-center`, never a `mt-*` guess.** A negative margin that simulates centring is a number tuned against one font size. | the task checkbox at `mt-0.5`, the "Propo" nav label at `-mt-1` |
| **Every control in a bar row uses `CONTROL_H`.** | the calendar's Día/Semana/Mes at ~34px beside a 40px button and a 44px touch target |
| **The tenant accent is not a member of any categorical palette.** It is derived from the workspace hue, so for some tenants it lands on `--success` and the legend becomes identical dots. Categories come from `shared/ui/category-palette.ts`. | `--accent-brand` as the colour of an event, colliding with Pago and Tarea |
| **Nested radii: the inner radius is the outer minus the padding.** Equal radii make the inner corner look unglued from the outer one. | cards inside cards |
| **`cn()` + tailwind-merge erases the base component's class in the same group.** `max-w-*` is one group, so a bare `max-w-md` deletes `max-w-[calc(100%-2rem)]`. Always prefix the override (`sm:max-w-md`). | the event dialog reaching both screen edges and looking borderless |
| **A component two features need is a shared component.** | `MapRow`, `ChoiceSwitch`, `PushToggle` |
| **The topbar is for actions that belong to the whole page, and tabs are for peers.** A `secondary` tab that only exists while it is open is navigation pretending to be a tab. | the Personas button injecting a tab with no way to close it; page-level actions living inside the page body |
| **Do not add a scrollable tab strip.** If the options do not fit, they are not tabs. | Clientes at seven tabs |
| **One sheet-footer convention: `SheetActions`.** | `size="block"` stacked buttons in the calendar next to `SheetActions` in thirteen other dialogs |

## Feature states (the kill switch)

Two independent gates decide whether a surface appears, and they answer
different questions:

| Gate | Where | Question | Storage |
|---|---|---|---|
| `admin_scope` | `require_scope` · `filterByScope` | may THIS PERSON? | `tenant_memberships.admin_scope` (empty = all) |
| feature state | `require_feature` · `filterByFeature` | is this READY here? | `feature_states`, per tenant |

Four states: `on` · `wip` (usable, labelled "En desarrollo") · `locked` (drawn
greyed, tap explains why, API 423) · `hidden` (absent, API 423). A row with
`tenant_id IS NULL` is the global default; a tenant row overrides it; no row
means `on`.

Catalog lives in `backend/app/core/features.py` and is mirrored in
`frontend/src/shared/feature/catalog.ts` — `catalog.test.ts` reads the Python
file and fails if they drift. Adding a key = one entry each side, then hang
`requiredFeature` / `feature:` on the route, nav item or tab.

Dev-admin switchboard: `/admin/settings/funcionalidades`. Built for a phone —
picking a state is the write, no save button.

## Usage telemetry

`usage_events` is written by the CLIENT (`core/telemetry/usage.ts`), buffered and
flushed every 20 s and on `visibilitychange` with `fetch(keepalive)` — not
`sendBeacon`, which cannot set headers and would put the access token in a query
string. Page-view keys are canonicalised (`/admin/personas/:id`), so no customer
id enters a telemetry key.

`propos-rollup-usage` (00:30 Santiago) calls `rollup_usage_daily()`, which
recomputes the last two days of `usage_daily` and purges events older than 90
days. `active_minutes` counts distinct one-minute buckets — attention, not
session length.

Read it at `/admin/finanzas?tab=uso` (dev admin): minutes per person, top
screens, named actions, and the Cloud Run instance-floor cost.

## Disaster recovery

`docs/disaster-recovery.md` — soft delete restore, audit-log replay, PITR, pre-incident checklist.

## Caveman mode

User runs `/caveman` skill (full mode). Chat replies = terse fragments, drop articles/filler/pleasantries/hedging. Code, commits, PR bodies, security warnings → normal prose. `stop caveman` or `normal mode` reverts.
