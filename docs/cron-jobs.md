# Cron jobs (Cloud Scheduler → internal endpoints)

Cloud Run scales to zero and can run multiple instances, so PropOS uses
**Cloud Scheduler** to drive periodic work instead of an in-process scheduler.
Each job is an HTTP POST to an internal endpoint, authenticated by a shared
secret header (`X-Internal-Key`), not a user JWT.

**Region is `us-central1`**, the same as the Cloud Run service. Cloud Scheduler
rejects `us-east2` outright (`INVALID_ARGUMENT: Location 'us-east2' is not a
valid location`), so any command copied with that region fails before it reaches
the API — this document used to instruct exactly that.

## Endpoints

| Job | Method + path | Cadence | Endpoint | Scheduler job |
|-----|---------------|---------|----------|---------------|
| Due reminders | `POST /api/v1/internal/jobs/run-due-reminders` | every 5 min | live | **not created** |
| Refresh analytics MVs | `POST /api/v1/internal/jobs/refresh-analytics` | every 15 min | live | **not created** |
| Email sync | `POST /api/v1/internal/jobs/email-sync` | every 5 min | live | **out of scope for v0.1.0** |

> **Production state (verified 2026-08-18): no Cloud Scheduler job exists** in
> `us-central1` or `us-east1`. The wiring is done — `INTERNAL_JOBS_SECRET` is in
> the `SECRETS` array of `scripts/sync_cloud_env.sh` and in the `--set-secrets`
> list of `config/docker/cloudbuild.yaml` — but the secret has no value in `.env`
> yet, so Secret Manager has nothing to mount and the endpoints answer `503`.
> Consequence today: reminders never fire and the analytics materialized views
> only refresh when an admin presses the manual button.
>
> Email sync is a separate matter: the Titan mailbox is out of scope for
> v0.1.0, and `scripts/sync_cloud_env.sh` pins `EMAIL_SYNC_ENABLED=false` in the
> generated Cloud Run env. Do not create that job until the mailbox is back in
> scope.

All internal endpoints return:
- `503` if `INTERNAL_JOBS_SECRET` is unset (feature disabled)
- `403` if the `X-Internal-Key` header doesn't match
- `200` with a JSON summary otherwise

Runners are idempotent (claim-first updates), so at-least-once delivery from
Cloud Scheduler is safe.

## Setup

1. Generate the secret, put it in `.env`, and push it to Secret Manager:

   ```bash
   openssl rand -hex 32          # add to .env as INTERNAL_JOBS_SECRET=<value>
   make deploy-secrets-sync      # creates the `internal-jobs-secret` secret
   ```

   Then push a commit touching `backend/**` or `config/docker/**` so the trigger
   redeploys and mounts it. Confirm with:

   ```bash
   make deploy-verify            # detail.integrations.internal_jobs == "on"
   ```

2. Create the scheduler jobs. `API_URL` is the Cloud Run URL, `SECRET` the value
   from step 1:

   ```bash
   API_URL=$(gcloud run services describe propos-api --region us-central1 --format='value(status.url)')
   SECRET=<the value from .env>

   gcloud scheduler jobs create http propos-reminders \
     --location=us-central1 \
     --schedule="*/5 * * * *" \
     --uri="$API_URL/api/v1/internal/jobs/run-due-reminders" \
     --http-method=POST \
     --headers="X-Internal-Key=$SECRET" \
     --attempt-deadline=120s

   gcloud scheduler jobs create http propos-refresh-analytics \
     --location=us-central1 \
     --schedule="*/15 * * * *" \
     --uri="$API_URL/api/v1/internal/jobs/refresh-analytics" \
     --http-method=POST \
     --headers="X-Internal-Key=$SECRET" \
     --attempt-deadline=300s
   ```

3. Verify:

   ```bash
   gcloud scheduler jobs run propos-reminders --location=us-central1
   gcloud scheduler jobs list --location=us-central1
   ```

   Then check Cloud Run logs for the `JOBS` event. Logs are JSON in production,
   so filter on `jsonPayload.event_type="job"` rather than scanning text.

`GET /health/ready` reports `detail.jobs.reminders_overdue`: reminders still
`PENDING` more than 15 minutes past due. A non-zero count there means the
reminders job is not running, which is the symptom this whole document exists to
prevent.

> Hardening note (post-v0.1.0): swap the shared-secret header for OIDC tokens
> (`--oidc-service-account-email`) so the endpoint validates a Google-signed
> identity instead of a static secret.

## WhatsApp inbound — the one manual switch

Kapso holds the destination URL in its dashboard and exposes no API for it
(`/api/v1/whatsapp_configs` returns the number's state but no webhook field, and
`.../webhook` is a 404). Verified against the live account on 2026-08-18:

| | |
|---|---|
| Number | `+56 9 5127 8204` |
| `phone_number_id` | `821920077680647` |
| Config id | `8a2ed241-58b7-4b08-a7dc-ce8b9950b13a` |
| Status | `CONNECTED`, `inbound_processing_enabled = true` |
| Webhook | verified 2025-11-24 |

So the webhook is **already registered and verified** — the task is to *repoint*
it, not to set it up. The last event this backend received was 2026-05-05, during
the development session that used a cloudflared tunnel, which means the
destination still points at that dead tunnel.

Set it to:

```
https://propos-api-blfjtiyx4q-uc.a.run.app/api/v1/integrations/kapso/webhook
```

Confirm it took by sending one message to the number and checking that the row
count moves:

```bash
make query SQL="select count(*), max(received_at) from kapso_webhook_events"
```

If the count moves but `signature_valid` is false, the dashboard's signing secret
and `KAPSO_WEBHOOK_SECRET` have diverged.
