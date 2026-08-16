# Cron jobs (Cloud Scheduler → internal endpoints)

Cloud Run scales to zero and can run multiple instances, so PropOS uses
**Cloud Scheduler** to drive periodic work instead of an in-process scheduler.
Each job is an HTTP POST to an internal endpoint, authenticated by a shared
secret header (`X-Internal-Key`), not a user JWT.

## Endpoints

| Job | Method + path | Cadence | Endpoint | Scheduler job |
|-----|---------------|---------|----------|---------------|
| Due reminders | `POST /api/v1/internal/jobs/run-due-reminders` | every 5 min | live | **not created** |
| Email sync | `POST /api/v1/internal/jobs/email-sync` | every 5 min | live | **not created** |
| Refresh analytics MVs | `POST /api/v1/internal/jobs/refresh-analytics` | every 15 min | **missing** | **not created** |

> **Production state (verified 2026-07-02): no Cloud Scheduler job exists.**
> `INTERNAL_JOBS_SECRET` was never added to `sync_cloud_env.sh` or to the
> `--set-secrets` list in `config/docker/cloudbuild.yaml`, so the endpoints answer
> `503` in prod even if a job were created. Consequence: reminders never fire and
> portal leads are never ingested. The analytics materialized views have no
> refresh endpoint at all — they only update when an admin presses the manual
> refresh button. Fixing this is Gate A of the v0.1.0 remediation plan.

All internal endpoints return:
- `503` if `INTERNAL_JOBS_SECRET` is unset (feature disabled)
- `403` if the `X-Internal-Key` header doesn't match
- `200` with a JSON summary otherwise

Runners are idempotent (claim-first updates), so at-least-once delivery from
Cloud Scheduler is safe.

## Setup

1. Set the secret on the Cloud Run service and in `.env`:

   ```bash
   # generate once
   openssl rand -hex 32
   # then add to .env (local) and the Cloud Run service env (prod):
   #   INTERNAL_JOBS_SECRET=<value>
   ```

2. Create the scheduler jobs (replace `<API_URL>` and `<SECRET>`):

   ```bash
   gcloud scheduler jobs create http propos-reminders \
     --location=us-east2 \
     --schedule="*/5 * * * *" \
     --uri="https://<API_URL>/api/v1/internal/jobs/run-due-reminders" \
     --http-method=POST \
     --headers="X-Internal-Key=<SECRET>" \
     --attempt-deadline=120s

   # P4 — email sync:
   gcloud scheduler jobs create http propos-email-sync \
     --location=us-east2 \
     --schedule="*/5 * * * *" \
     --uri="https://<API_URL>/api/v1/internal/jobs/email-sync" \
     --http-method=POST \
     --headers="X-Internal-Key=<SECRET>" \
     --attempt-deadline=300s
   ```

3. Verify: `gcloud scheduler jobs run propos-reminders --location=us-east2` then
   check Cloud Run logs for the `JOBS` event.

> Hardening note (post-v0.1.0): swap the shared-secret header for OIDC tokens
> (`--oidc-service-account-email`) so the endpoint validates a Google-signed
> identity instead of a static secret.
