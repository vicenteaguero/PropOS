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

1. **GitHub Actions `CI`** — ruff + pytest with the coverage gate, eslint +
   prettier + tsc + vitest + build, and the migration checks. Runs on `main`,
   `dev` and every PR.
2. **Vercel `prop-os`** — production deploy. Any other branch produces a preview
   deploy in the same project, which is why a push to `dev` shows up in
   `prop-os` as `Preview` and in `prop-os-edge` as `Production`.
3. **GitHub Actions job `deploy-backend`** (in `ci.yml`) — only when the push
   touches `backend/**` or `config/docker/**`. Runs `gcloud builds submit` with
   `config/docker/cloudbuild.yaml`, which builds
   `config/docker/backend.prod.Dockerfile`, tags the image with the commit SHA
   *and* `latest`, deploys to Cloud Run, and smoke tests the result.

### Why the deploy moved out of Cloud Build's own trigger

`propos-api-deploy` was a Cloud Build GitHub-App trigger. Its installation link
broke at some point — `gcloud builds triggers describe propos-api-deploy` returns
**no `installationId`** — so pushes to `main` stopped producing a build and the
backend silently stayed on an old revision while `main` moved on. Nothing failed
loudly; the deploy just never happened.

Reconnecting a legacy GitHub App is a console OAuth flow that cannot be scripted,
so the deploy now lives in the repo instead:

- The trigger is **disabled**, with the reason in its description. Re-enable it
  only after reconnecting the App in the console, and disable the Actions job
  first — otherwise both would deploy the same commit.
- Auth is **Workload Identity Federation**, so there is no service-account key
  anywhere. The pool provider only accepts tokens whose `repository` claim is
  `vicenteaguero/PropOS`:

  ```
  pool      projects/694860045239/locations/global/workloadIdentityPools/github
  provider  .../providers/github   (attribute-condition on assertion.repository)
  identity  propos-cloudbuild@propos-489401.iam.gserviceaccount.com
  ```

- CI now gates the deploy **natively** through `needs: [backend, frontend,
  migrations]`, instead of `cloudbuild.yaml` polling the Checks API and hoping.
  The in-build `ci-gate` still runs as a backstop for manual submits.

`make deploy-backend` remains the manual escape hatch. It needs
`scripts/check_ci_status.py` in the upload, which is why `.gcloudignore`
excludes `/scripts/*` and then negates that one file — excluding `/scripts/`
outright makes the negation impossible and the gate fails with
`can't open file '/workspace/scripts/check_ci_status.py'`.

### The trigger can be disabled, and a disabled trigger is silent

`propos-api-deploy` was found **disabled** on 2026-08-22. Nothing warns about
this: pushes to `main` simply produce no build, and the last successful deploy
(2026-08-19) keeps serving. Every backend change merged in between was live in
the database — migrations are applied by hand — and absent from the API.

Check it with:

```bash
gcloud builds triggers describe propos-api-deploy --region=us-central1 \
  --format='value(disabled)'
```

`gcloud builds triggers run <name> --branch=main` still works while disabled, so
a manual build is the escape hatch.

Re-enabling has a trap. `PATCH ?updateMask=disabled` with `{"disabled":false}`
returns 200 and a body showing `disabled: false` — and changes nothing, because
`false` is the proto3 default for a bool and the server reads the field as
unset. What works is sending the whole trigger back with the key **removed**:

```bash
U="https://cloudbuild.googleapis.com/v1/projects/propos-489401/locations/us-central1/triggers/propos-api-deploy"
T=$(gcloud auth print-access-token)
curl -s "$U" -H "Authorization: Bearer $T" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); [d.pop(k,None) for k in ('disabled','createTime','resourceName')]; print(json.dumps(d))" \
  | curl -s -X PATCH "$U" -H "Authorization: Bearer $T" -H "Content-Type: application/json" -d @- > /dev/null
gcloud builds triggers describe propos-api-deploy --region=us-central1 --format='value(disabled)'  # empty = enabled
```

### CI gates the backend deploy

Cloud Build fires on the push, not on the CI result, so for a long time a commit
that broke the suite still built an image and ran `gcloud run deploy`. The
`ci-gate` step in `config/docker/cloudbuild.yaml` closes that: it polls the
GitHub Checks API for the commit and refuses to deploy unless
`Backend (ruff + pytest)`, `Frontend (…)` and `Migrations (…)` all succeeded.

- The repository is public, so the Checks API answers with no token, no secret
  and no extra IAM. Anonymous calls are capped at 60/hour per IP; a deploy uses
  a handful.
- The gate runs in **parallel** with the image build, so it only adds wall-clock
  time when CI is slower than docker.
- It **fails closed**. An unreachable API, a renamed CI job or a check that never
  reports all block the deploy rather than waving it through.
- Renaming a job in `ci.yml` means updating `REQUIRED_CHECKS` in
  `scripts/check_ci_status.py`, or the gate stalls until it times out.

Emergency deploy without waiting for CI:

```bash
gcloud builds submit --config config/docker/cloudbuild.yaml \
  --substitutions=_SKIP_CI_GATE=true .
```

Manual `make deploy-backend` builds have no commit SHA, so the gate does not
apply — whoever runs it is the gate.

### Branch protection (not enabled)

The pipeline gate above stops a red commit reaching Cloud Run, but nothing stops
it reaching `main` in the first place: `gh api repos/:owner/:repo/branches/main/protection`
returns **404** and there are no rulesets. Enabling it needs repo-admin rights.
Run this as the repository owner:

```bash
gh api -X PUT repos/vicenteaguero/PropOS/branches/main/protection \
  --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "Backend (ruff + pytest)",
      "Frontend (eslint + prettier + tsc + build)",
      "Migrations (naming + ordering)"
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
```

`enforce_admins: false` deliberately: with a single maintainer, locking the
owner out of an emergency push costs more than it buys. Verify with:

```bash
gh api repos/vicenteaguero/PropOS/branches/main/protection \
  --jq '.required_status_checks.contexts'
```

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
make deploy-verify         # poll /health/ready on the live service
make deploy-frontend-edge  # publish the frontend to prop-os-edge (staging)
```

There is deliberately no target that publishes the frontend to production: both
`.vercel/project.json` files link to `prop-os-edge`, so a local `vercel --prod`
publishes to staging whatever the flag says. Production ships by pushing `main`.

## Cron jobs

Five Cloud Scheduler jobs exist in `us-central1`, all verified running:
`propos-reminders`, `propos-refresh-analytics`, `propos-rollup-usage`,
`propos-scale-up` and `propos-scale-down`. See `docs/cron-jobs.md` for cadence,
the two authentication schemes, and the manual overrides.

## Instance floor

`--min-instances` is **immutable per revision**: passing it in the deploy pins
the floor to whatever `cloudbuild.yaml` says and silently undoes any schedule.
The deploy therefore does not pass it, and the floor lives as service-level
state (`gcloud run services update --min`, which changes in place without
cutting a revision).

Two Cloud Scheduler jobs move it: up at 08:00, down at 00:00, America/Santiago.

Cost at the deployed shape (2 vCPU, 1 GiB), using the us-central1 min-instance
SKUs — `$0.0000025` per vCPU-second and per GiB-second, read from the Cloud
Billing catalog (service `152E-C115-5142`), not from memory:

```
24/7      2 x 2,628,000s x 0.0000025 = $13.14  +  1 x ... = $6.57  ->  $19.71/mo
08h-00h   16 of 24 hours                                          ->  $13.14/mo
```

The Uso tab (`/admin/finanzas?tab=uso`) prints the same estimate from the same
constants, so the number is visible in the app rather than only in a console.

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

## Outbound email (Resend)

`RESEND_FROM_EMAIL` must stay on a domain that is **verified in Resend**. The only
verified one is `anaida.cl`; the previous default (`no-reply@propos.dev`) was never
verified, so every send failed with a 403 that surfaced only in the dispatcher log.
Confirm before changing the sender:

```bash
curl -s https://api.resend.com/domains -H "Authorization: Bearer $RESEND_API_KEY"
```

### DNS authentication status (checked 2026-08-18)

| Record | Host | State |
|---|---|---|
| DKIM | `resend._domainkey.anaida.cl` | verified |
| SPF | `send.anaida.cl` (TXT + MX) | verified |
| DMARC | `_dmarc.anaida.cl` | `v=DMARC1; p=none;` — **weak** |

DKIM and SPF are correct, and DMARC passes through DKIM alignment (the From domain
is `anaida.cl` and the DKIM signature is on that domain; Resend uses
`send.anaida.cl` only as the Return-Path). So mail authenticates.

What is missing is policy strength. `p=none` with no `rua=` neither enforces
anything nor collects reports, which is why the first delivery to Outlook carried a
"You don't often get email from…" sender-identification warning. At volume that
costs inbox placement.

**Recommended change** (DNS, at the registrar — not in this repo):

```
_dmarc.anaida.cl  TXT  "v=DMARC1; p=none; rua=mailto:dmarc@anaida.cl; fo=1"
```

Collect reports for two or three weeks, confirm every legitimate sender aligns, then
tighten to `p=quarantine` and eventually `p=reject`. Do not jump straight to
enforcement: any other system sending as `@anaida.cl` (the broker's own mail client,
a portal, a CRM) would start bouncing silently.
