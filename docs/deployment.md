# Deployment

How a commit becomes production, what each environment is wired to, and how to
undo a bad deploy.

## Environment matrix

| | Production | Staging |
|---|---|---|
| Branch | `main` | `dev` |
| Vercel project | `prop-os` | `prop-os-edge` |
| URL | https://prop-os-delta.vercel.app | https://prop-os-edge.vercel.app |
| Vercel Root Directory | `.` (uses root `vercel.json`) | `frontend` (uses `frontend/vercel.json`) |
| Backend | Cloud Run `propos-api`, `us-central1` | **the same service** |
| Database | Supabase `tlbkwrjzraaikdrajwqh`, schema `public` | **the same schema** |

Two things follow from that table and are easy to forget:

- **There is one backend and one database.** Staging is a frontend-only
  environment. A migration, a schema change, or a backend deploy hits production
  the moment it lands, whichever branch triggered it. `propos_test` is a schema
  for the automated test suite, not a staging database.
- **Both frontends talk to the same Cloud Run service**, so `ALLOWED_ORIGINS`
  must list both origins. It is generated with both by
  `scripts/sync_cloud_env.sh`; dropping one silently breaks that frontend with a
  CORS error rather than an obvious failure.

## What a push triggers

Pushing to `main`:

1. **GitHub Actions `CI`** — ruff + pytest (unit only) + eslint + prettier +
   tsc + vitest + build. Runs on `main`, `dev` and every PR. It does not gate
   the deploys below; they run in parallel.
2. **Vercel `prop-os`** — production deploy. Any other branch produces a preview
   deploy in the same project, which is why a push to `dev` shows up in
   `prop-os` as `Preview` and in `prop-os-edge` as `Production`.
3. **Cloud Build `propos-api-deploy`** — only when the push touches `backend/**`
   or `config/docker/**`. Builds `config/docker/backend.prod.Dockerfile`, tags
   the image with the commit SHA *and* `latest`, and deploys to Cloud Run.

The trigger itself lives only in GCP (the legacy GitHub app cannot be scripted
without an installation id). `make deploy-trigger-list` shows it;
`make deploy-trigger-setup` prints the settings to recreate it by hand.

## Configuration

`.env` at the repo root is the single source of truth. `make deploy-secrets-sync`
(→ `scripts/sync_cloud_env.sh`) splits it in two:

- **Secrets** → GCP Secret Manager, one secret per key, named lowercase-with-dashes
  (`GROQ_API_KEY` → `groq-api-key`). Empty values are skipped.
- **Non-secrets** → `config/docker/cloudrun-env.yaml`, committed to git, with
  production overrides applied for `APP_ENV`, `LOG_LEVEL`, `ALLOWED_ORIGINS`.

`config/docker/cloudbuild.yaml` mounts only the secrets that actually exist, so
listing an integration you have not provisioned yet is inert — the feature stays
dark and the deploy still succeeds. Provisioned today:

    supabase-url, supabase-anon-key, supabase-service-role-key,
    vapid-public-key, vapid-private-key, cerebras-api-key, groq-api-key

Declared but **not provisioned** (the features are code-complete and switched
off): `kapso-api-key`, `kapso-webhook-secret`, `kapso-phone-number-id`,
`resend-api-key`, `internal-jobs-secret`, `agent-readonly-db-url`,
`email-imap-user`, `email-imap-password`. Fill the value in `.env`, run
`make deploy-secrets-sync`, push — the next deploy mounts it.

### The rename trap

Settings use `extra="ignore"`, so an env var whose name no longer matches a
field is dropped without a word and the field falls back to its default. That is
how Cloud Run ran on code defaults for months while shipping `ANITA_*` vars the
code had stopped reading. `backend/app/core/config/settings.py` now refuses to
boot if any `ANITA_*` is present. A revision that cannot start never receives
traffic, so a mistake here fails the deploy instead of the product.

### Frontend variables

Set per Vercel project, and they are baked into the bundle at build time — a
change requires a redeploy, not just a save.

| Variable | Value |
|---|---|
| `VITE_API_URL` | the Cloud Run service URL |
| `VITE_SUPABASE_URL` | `https://tlbkwrjzraaikdrajwqh.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |
| `VITE_VAPID_PUBLIC_KEY` | web-push public key, must match `vapid-public-key` |

Vercel marks these Sensitive, so `vercel env pull` returns empty strings and
cannot be used to compare projects. To check what a deployed site actually got,
read the bundle:

```bash
js=$(curl -s https://prop-os-edge.vercel.app/ | grep -oE '/assets/index-[A-Za-z0-9_-]+\.js' | head -1)
curl -s "https://prop-os-edge.vercel.app$js" | grep -oE 'https://propos-api[a-z0-9.-]*\.run\.app' | sort -u
```

## Rolling back

Images are tagged by commit SHA, so a revision maps to a commit:

```bash
make deploy-rollback                      # lists the last 10 revisions
make deploy-rollback REV=propos-api-00045-xyz
```

The frontend rolls back from the Vercel dashboard (Deployments → ⋯ → Promote to
Production).

## Manual deploys

```bash
make deploy-backend        # build + deploy Cloud Run, bypassing the trigger
make deploy-verify         # curl /health on the live service
make deploy-frontend-edge  # publish the frontend to prop-os-edge (staging)
```

There is deliberately no target that publishes the frontend to production: both
`.vercel/project.json` files link to `prop-os-edge`, so a local `vercel --prod`
publishes to staging whatever the flag says. Production ships by pushing `main`.

## Cron jobs

Two Cloud Scheduler jobs are specified in `docs/cron-jobs.md` and **neither
exists yet**. The API is enabled and the endpoints are live, but they answer 503
until `internal-jobs-secret` is provisioned. Creating the jobs is part of
turning production on, tracked separately from this deployment wiring.

## Health

Two endpoints, two different questions.

`GET /health` is liveness: a static `{"status":"healthy"}` that proves the
process is up and nothing else. It is what a restart policy should poll, and it
cannot fail for any reason short of a dead container.

`GET /health/ready` is readiness. It reads one row through PostgREST and checks
that the core secrets are present, so a rotated Supabase key, a free-tier
project paused for inactivity or an unmounted secret answer **503** instead of
green. Optional integrations (Kapso, Resend, internal jobs, `agent_readonly`,
email sync) are reported but never fail the check — they are off on purpose
until their secret is provisioned.

```json
{"status":"ready","checks":{"database":"ok","secrets":"ok"},
 "detail":{"missing_secrets":[],"integrations":{"whatsapp_kapso":"off"},
           "jobs":{"status":"ok","reminders_overdue":0}}}
```

`detail` is only included outside production, or when the request carries
`X-Internal-Key: $INTERNAL_JOBS_SECRET` — a public endpoint should not
enumerate the deployment's wiring. `make deploy-verify`, the post-deploy smoke
test in `config/docker/cloudbuild.yaml` and `.github/workflows/keepalive.yml`
all poll `/health/ready`, and all three now exit non-zero when it is not 200.
