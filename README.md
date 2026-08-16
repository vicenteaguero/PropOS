# PropOS

Multi-tenant real estate operations platform for Chilean brokerages. PWA-first,
Spanish UI, dark theme by default.

PropOS puts one broker's whole day in a single app: a WhatsApp/voice AI assistant
("Propo") that turns a spoken note into CRM records, a contact/opportunity
pipeline, calendar and tasks, document scanning and sharing, portal-lead email
sync, and commission/payment tracking — all scoped per tenant.

> Status: **v0.1.0, pre-production.** Feature-complete against most of the spec,
> but not yet wired for production operation. See
> [`docs/versions/v0.1.0.md`](docs/versions/v0.1.0.md) for the honest per-feature
> status.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19 · TypeScript · Vite 6 · Tailwind v4 · shadcn/ui · TanStack Query · react-router 7 · vite-plugin-pwa |
| Backend | FastAPI · Poetry · structlog · pydantic-settings · Supabase Python client |
| Database | Supabase Postgres (RLS per tenant), sequential SQL migrations |
| AI | Groq (LLM classifier + Whisper STT) |
| Channels | Kapso (WhatsApp BSP) · Resend (email) · IMAP (portal-lead sync) · Web Push |
| Deploy | Cloud Run (backend) · Vercel (frontend) · Cloud Scheduler (cron) |

## Layout

```
backend/app/{core,features}/   FastAPI features: router.py · service.py · schemas.py
frontend/src/{app,core,features,layouts,shared}/
supabase/migrations/           sequential SQL
config/docker/                 Cloud Build + Cloud Run config
docs/                          architecture, API, roles, compliance, runbooks
_archive/                      reference-only code from the v0 prototype
```

## Quick start

```bash
cp etc/.env.example .env       # fill Supabase + Groq keys
make setup
make dev-pwa-hmr               # backend :8000 · vite :5173 · HTTPS proxy :5443
```

Other common targets:

```bash
make lint                      # ruff + eslint + prettier
make format
make test                      # pytest + vitest
make migrate                   # supabase db push
make query SQL="select 1"      # read-only DB query
```

Full environment notes, gotchas and conventions live in
[`CLAUDE.md`](CLAUDE.md).

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — system design
- [`docs/api.md`](docs/api.md) · [`docs/api-conventions.md`](docs/api-conventions.md)
- [`docs/roles.md`](docs/roles.md) — role matrix (admin, agent, owner, buyer, visitor)
- [`docs/cron-jobs.md`](docs/cron-jobs.md) — Cloud Scheduler jobs
- [`docs/disaster-recovery.md`](docs/disaster-recovery.md) — restore, audit replay, PITR
- [`docs/compliance/`](docs/compliance/) — Ley 21.719: privacy policy, RAT, subprocessors
- [`docs/versions/v0.1.0.md`](docs/versions/v0.1.0.md) — release status

## Conventions

- **Code in English, UI in Spanish.** Routes, models, filenames, comments and log
  messages are English; anything a broker reads is Spanish.
- Commits: `<type>(<scope>): :gitmoji: <lowercase english summary>`, one file per commit.
- Every page ships a loading state, an error state with retry, and an empty state.

## Security

This repository is public; the deployment is not. Never commit `.env`, service-role
keys, mailbox credentials, or customer data (mailbox exports and property sheets are
gitignored). To report a vulnerability, email the maintainer rather than opening a
public issue.

## License

MIT — see [`LICENSE`](LICENSE).
