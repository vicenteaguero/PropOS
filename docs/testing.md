# Testing

Two suites with very different costs. Read the second section before running
anything that touches the database.

```bash
make test                                   # backend unit + frontend unit
cd backend  && poetry run pytest             # unit only (default marker filter)
cd backend  && poetry run pytest --no-cov -q # same, without the coverage gate
cd frontend && npm test                      # vitest run
```

## Backend unit tests

`backend/pyproject.toml:55` sets the defaults, and the marker filter is the
important half:

```
addopts = "--cov=app --cov-report=term-missing --cov-fail-under=53 -m 'not integration'"
```

So a bare `pytest` runs **unit tests only** and fails if line coverage drops
below the current measured floor. That floor is a ratchet, not a target: raise
it when coverage rises, never lower it to go green.

`backend/tests/conftest.py` stubs the three Supabase env vars and overrides
`get_current_user` with a fixed user — ADMIN, `is_dev_admin=True`,
`admin_scope=[]`. That user clears every gate, which is deliberate: it lets a
feature test exercise the handler without a live token. It also means a test
using the plain `client` fixture proves nothing about authorization. Tests that
*do* check gates build their own app and override the dependency themselves —
see `tests/test_router_scopes.py` and `tests/features/documents/test_router_access.py`.

Markers (`pyproject.toml:56-59`):

| Marker | Meaning |
|---|---|
| `integration` | hits real Supabase and/or a real LLM provider — slow, spends tokens |
| `whisper` | hits Groq Whisper, rate-limited to 20 req/min; only for measuring STT quality |

## Integration tests and the `propos_test` schema

**There is one Supabase project, so `public` is production.** Integration tests
run against `propos_test`, a schema in the same database that mirrors `public`'s
structure. The Supabase client routes to it through `SUPABASE_DB_SCHEMA`
(`backend/app/core/supabase/client.py:21`), which PostgREST honours via
`Accept-Profile` / `Content-Profile` headers.

The session fixture in `backend/tests/integration/agent/conftest.py:47-71`
probes PostgREST for the schema and **aborts the whole run** if it is not
exposed:

```
PostgREST does not expose schema 'propos_test'. Refusing to run integration
tests against 'public' — that is the production schema.
Fix: `make test-schema-rebuild`, and check `[api] schemas` in supabase/config.toml.
```

That hard stop replaced the previous behaviour, which warned and then wrote to
production — a warning nobody reads in CI output. Do not soften it.

Two things must both be true for the schema to be reachable:

1. `supabase/config.toml` `[api] schemas = ["public", "propos_test"]`.
2. Supabase Dashboard → Project Settings → API → **Exposed schemas** includes
   `propos_test`.

### Rebuilding the schema

```bash
make test-schema-rebuild            # drop + recreate propos_test from public
make test-schema-rebuild DRY=1      # print the SQL, change nothing
```

`backend/scripts/rebuild_test_schema.py` clones every base table of `public`
with `CREATE TABLE ... (LIKE public.<t> INCLUDING ...)`. Foreign keys are
deliberately not carried over — cross-schema FKs would point back at production
rows. Before executing, every statement is checked against a denylist of write
verbs applied to `public`; one match aborts the run. The schema was originally
hand-written and drifted three months stale, which is why it is regenerated
rather than maintained.

### Running them

```bash
make test-agent              # agent LLM matrix, cached transcripts
make test-agent-whisper      # STT quality, rate-limited
make test-agent-full         # both, all providers
make test-agent-cache-refresh# re-transcribe the fixture audios

# or directly
cd backend && poetry run pytest tests/integration -m 'integration and not whisper' -q --no-cov
```

The `make` targets source `.env` and force `ALLOWED_ORIGINS` to localhost
(`Makefile:115`). Running `pytest -m integration` by hand needs at least
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `GROQ_API_KEY` in the
environment; the fixture reports which are missing and skips rather than
failing on a traceback.

### The tests that run against production on purpose

`tests/integration/test_cross_tenant.py` and `test_rls_helpers.py` do **not**
use the Supabase client at all. They open psycopg directly and impersonate the
`authenticated` role (`SET LOCAL ROLE authenticated` plus
`request.jwt.claims` / `app.current_tenant_id`), because that is what PostgREST
does per request — and because a test built on the service-role client is
`BYPASSRLS` and would go green whether the policies are right or not.

They run against the production database, since there is only one. The
protocol: seed inside the transaction, prefix every marker with `_xtest_`,
never commit — the `cur` fixture rolls back after each test. They skip
automatically when the DB credentials are absent.

Each assertion has two halves — the other tenant must not see the row, **and**
the owning tenant must still see it. The second half is the one that catches a
deny-everything policy, which looks like perfect isolation and silently breaks
the feature.

## Frontend

`vitest run` with jsdom, config in `frontend/vitest.config.ts`. The include glob
is `src/**/*.test.{ts,tsx}` — the `.tsx` matters, because an earlier `*.test.ts`
glob silently collected no component tests while CI passed
`--passWithNoTests` and reported green. Neither shortcut is in place now; keep
it that way.

Setup file: `frontend/src/test/setup.ts`.

## In CI

`.github/workflows/ci.yml` runs lint, unit tests, typecheck, build and a
migrations check on every push to `main`/`dev` and on every PR. The integration
job is **nightly and on-demand only** (`schedule` + `workflow_dispatch`), because
it hits the real project and spends Groq tokens; it exports
`SUPABASE_DB_SCHEMA=propos_test` so a misconfigured run cannot reach production,
and it warns-and-skips instead of failing when a repo secret is missing. See
`docs/deployment.md` for how CI relates to deploys.

## Other harnesses

Not tests — visual/manual tools that live under `tests/integration/`:

| Command | What it does |
|---|---|
| `make test-scanner` | document scanner pipeline: photo folders → PDFs in `output/` |
| `make test-docscanner` | same, with the DocScanner-L model (downloads weights on first run) |
| `make anita-try AUDIO=… \| TEXT=…` | one-shot agent turn against `propos_test` |
| `make test-anita-report` | summarise `tests/integration/agent/results.jsonl` |
