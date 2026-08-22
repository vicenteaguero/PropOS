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

| Job | Method + path | Cadence | Scheduler job |
|-----|---------------|---------|---------------|
| Due reminders | `POST /api/v1/internal/jobs/run-due-reminders` | `*/5 * * * *` UTC | `propos-reminders` |
| Refresh analytics MVs | `POST /api/v1/internal/jobs/refresh-analytics` | `*/15 * * * *` UTC | `propos-refresh-analytics` |
| Roll up usage | `POST /api/v1/internal/jobs/rollup-usage` | `30 0 * * *` America/Santiago | `propos-rollup-usage` |
| Email sync | `POST /api/v1/internal/jobs/email-sync` | — | **not created** (Titan out of scope) |

The usage rollup recomputes the last two days of `usage_daily` from
`usage_events` and purges raw events older than 90 days. It recomputes rather
than accumulates, so a duplicate delivery produces the same rows.

## Jobs that are not internal endpoints

The instance floor is moved by two jobs that call the **Cloud Run Admin API**
directly — no application code is involved, and they authenticate with an OAuth
token for `propos-scaler@propos-489401.iam.gserviceaccount.com` rather than with
`X-Internal-Key`.

| Job | Cadence (America/Santiago) | Effect |
|-----|---------------------------|--------|
| `propos-scale-up` | `0 8 * * *` | `scaling.minInstanceCount = 1` |
| `propos-scale-down` | `0 0 * * *` | `scaling.minInstanceCount = 0` |

Two details that are easy to get wrong:

- **Cloud Scheduler cannot send `PATCH`.** Its `--http-method` accepts only
  delete/get/head/post/put. The jobs POST with `X-HTTP-Method-Override: PATCH`,
  which the Google JSON API honours.
- **The scaler needs `actAs` on the runtime service account.** `roles/run.admin`
  on the service alone returns `PERMISSION_DENIED` (status code 7), because
  updating a service implies acting as the identity it runs under. The scaler
  also holds `roles/iam.serviceAccountUser` on
  `694860045239-compute@developer.gserviceaccount.com`.

Manual override: `make scale-up`, `make scale-down`, `make scale-status`.

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
