# PropOS Architecture

Multi-tenant real estate operations platform. One FastAPI service, one React
PWA, one Supabase Postgres database. Every claim below was checked against the
code or the live database; where the design has a known hole, it is named.

## Stack

| Layer | Choice |
|---|---|
| Backend | Python 3.12 · FastAPI · Poetry · structlog · pydantic-settings |
| Frontend | React 19 · TypeScript · Vite 6 · Tailwind v4 · shadcn/ui · TanStack Query · react-router 7 · vite-plugin-pwa |
| Database | Supabase Postgres (single project, single `public` schema = production) |
| Auth | Supabase Auth, JWT bearer tokens |
| Storage | Supabase Storage — `documents` (private), `media`, `avatars` |
| AI | Groq (LLM + Whisper STT), called server-side only |
| Deploy | GCP Cloud Run (backend) · Vercel (frontend) — see `docs/deployment.md` |

## Request path

```
browser ──JWT──▶ FastAPI (Cloud Run) ──service-role key──▶ PostgREST ──▶ Postgres
   │
   └──anon key + JWT──▶ Supabase Auth · Storage · Realtime · media_files
```

1. The frontend signs in through Supabase Auth and holds a JWT.
2. API calls carry `Authorization: Bearer <jwt>` and, optionally,
   `X-Tenant-Id`.
3. `get_current_user` (`backend/app/core/dependencies.py:19-46`) verifies the
   token with Supabase and loads `profiles` merged with the active
   `tenant_memberships` row.
4. `get_tenant_id` → `resolve_active_tenant` (`backend/app/core/tenant.py`)
   validates that the caller has an active membership in the requested tenant
   and calls the `activate_tenant` RPC when it differs from the stored snapshot.
5. The route's service layer queries PostgREST **through a service-role client**
   and filters by `tenant_id` in Python.

Step 5 is the one that matters, and the next section is about why.

## Tenant isolation — how it actually works

**RLS is not the backstop for API traffic.** The backend holds exactly one
Supabase client (`backend/app/core/supabase/client.py:12-27`) and it is built
with `settings.supabase_service_role_key`. In Postgres, `service_role` is
`BYPASSRLS`:

```
rolname        | rolbypassrls
---------------+-------------
service_role   | t
authenticated  | f
anon           | f
agent_readonly | f
```

So every policy in the database is invisible to the API path. What isolates
tenants on that path is the `.eq("tenant_id", str(tenant_id))` written by hand
in each feature's `service.py` — for example
`backend/app/features/properties/service.py:45,62,86,94`. **A forgotten
`tenant_id` filter is a cross-tenant data leak with nothing underneath to catch
it.** Treat the filter as the security control it is, and note that
`tests/integration/test_cross_tenant.py` exists precisely because a test written
on the service-role client would pass either way.

### Where RLS does apply

The 189 policies on 58 tables in `public` are not decorative; they guard the
paths that do *not* go through the service-role client.

| Path | Postgres role | RLS |
|---|---|---|
| FastAPI → PostgREST | `service_role` | bypassed |
| Browser → PostgREST (`media_files`), Realtime, Storage | `authenticated` / `anon` | **enforced** |
| Agent `text_to_sql` | `agent_readonly` | **enforced** |

The browser is not purely an API client: `frontend/src/shared/hooks/use-media-files.ts`
reads and inserts `media_files` directly with the anon key plus the user's JWT,
and `frontend/src/core/supabase/realtime.ts` opens Postgres Changes channels.
Those requests run as `authenticated`, so the `TO authenticated` policies (170 of
the 189) are the only thing standing between one tenant and another there.

### `agent_readonly` — the deliberate exception

`text_to_sql` executes LLM-written `SELECT`s. It does **not** use the
service-role client. It opens a dedicated psycopg connection as the
`agent_readonly` role, which is `NOBYPASSRLS` and holds `SELECT` on a
16-table allowlist plus one policy per table
(`supabase/migrations/20240601000049_agent_readonly_least_privilege.sql`).
`backend/app/features/agent/tools/query_sql.py:48-56` sets
`request.jwt.claims` and `app.current_tenant_id` on the session so
`public.get_my_tenant_id()` resolves; without those two `set_config` calls every
policy evaluates against NULL and the tool silently returns zero rows. SQL is
additionally parsed and constrained by `agent/tools/sql_guard.py` before it runs.

### Coverage caveats

- 59 base tables in `public`, all with RLS enabled. 58 carry at least one
  policy; `kapso_webhook_events` has RLS on and **no policy**, so it is
  deny-all for every non-bypass role — reachable only through the service-role
  backend, which is the intent.
- Re-derive these numbers rather than trusting this paragraph:
  `select count(*) from pg_policies where schemaname='public';`

### `propos_test`

There is one Supabase project, so `public` **is** production. The integration
suite runs against a `propos_test` schema that mirrors `public`'s structure;
the client picks it up through `SUPABASE_DB_SCHEMA`
(`core/supabase/client.py:21`). See `docs/testing.md`.

## Authorization

Three gates — `require_role`, `require_scope`, `require_dev_admin` — all in
`backend/app/core/dependencies.py`. The scope axis has one counter-intuitive
rule that decides who can do what: **an empty `admin_scope` grants full access**.
`docs/roles.md` is the reference; `docs/api.md` lists the effective gate per
endpoint.

## Auditing

27 audit triggers, one per table, cover 27 of the 59 tables in `public`.
They write `before`/`after` JSONB into `audit_log`. The `source` and `agent_session_id` columns are populated from the
`app.action_source` / `app.agent_session_id` GUCs or the equivalent request
headers, which is how a mutation made by the agent is distinguished from one
made by a person. `changed_by` is populated from `auth.uid()` and is therefore
**always NULL for backend writes** — see `docs/disaster-recovery.md`.

## Feature layout

The backend is organised by feature, not by layer. 45 routers are mounted in
`backend/app/main.py`; each feature directory holds `router.py`
(HTTP + dependencies), `service.py` (business logic + Supabase calls) and
`schemas.py` (Pydantic models).

```
backend/app/
  core/            config · dependencies · logging · middleware · supabase · tenant · ai_guard
  features/<name>/ router.py · service.py · schemas.py
  main.py          app factory, router mounting, /health, /health/ready
frontend/src/
  app/             router + providers
  core/            supabase client, theme, env
  features/<name>/ pages · components · hooks · api
  layouts/         app shell (sidebar desktop · bottom-nav mobile)
  shared/          design kit, hooks, types
supabase/migrations/   sequential SQL, the only schema source of truth
config/docker/         Dockerfiles, cloudbuild.yaml, cloudrun-env.yaml
scripts/               setup, dev, deploy, env sync
etc/                   .env.example
_archive/v0-prototype/ reference patterns, not in the build path
```

## Cross-cutting middleware

`TimingMiddleware` and `TenantMiddleware` wrap every request
(`main.py:176-177`); `SKIP_MIDDLEWARE_PATHS` (`core/config/constants.py:6`)
exempts `/health`, `/docs`, `/openapi.json` and `/redoc`. CORS origins come from
`ALLOWED_ORIGINS`, which must list both Vercel projects.

## Background work

Cloud Run scales to zero, so there is no in-process scheduler. Two internal
endpoints (`POST /api/v1/internal/jobs/run-due-reminders`, `.../email-sync`) are
meant to be driven by Cloud Scheduler over a shared-secret header. They return
503 until `INTERNAL_JOBS_SECRET` is provisioned, and **the Scheduler jobs do not
exist yet** — see `docs/cron-jobs.md`.

## Local development

`make dev-pwa-hmr` runs the backend on `:8000`, Vite on `:5173` and an HTTPS
proxy on `:5443` for iPhone testing. `make dev` brings the whole stack up under
Docker Compose. Details and gotchas live in `CLAUDE.md`.

## Related documents

- `docs/api.md` — every route, with its effective gate
- `docs/roles.md` — the role × scope matrix
- `docs/api-conventions.md` — rules for new endpoints
- `docs/testing.md` — unit vs integration, and the `propos_test` schema
- `docs/environment.md` — every environment variable and where it is read
- `docs/deployment.md` · `docs/cron-jobs.md` · `docs/disaster-recovery.md`
