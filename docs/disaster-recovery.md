# Disaster recovery — PropOS

There is **one** Supabase project (`tlbkwrjzraaikdrajwqh`, us-east-2) and its
`public` schema **is** production. Read the first section before you rely on
anything else in this file.

## What actually exists today

| Tier | Status |
|---|---|
| Point-in-Time Recovery | **Not available.** PITR is a paid Supabase add-on (Pro plan and above); this project runs on the free plan. |
| Supabase daily automated backups | **Not available** on the free plan either. |
| Manual logical dump | **Available and exercised** — see below. Not automated, not scheduled. |
| Soft delete (`deleted_at`) | 21 of 59 tables. Not universal. |
| `audit_log` journal | 27 of 59 tables. Not universal, and `changed_by` is always NULL. |

Verify the first two rows at **Dashboard → Settings → Database → Backups**
before an incident, not during one. Until that page says otherwise, assume a
data loss older than your last manual dump is **unrecoverable**, and plan
accordingly.

## Manual logical backup (the only real snapshot)

A verified backup was taken on 2026-08-18 at HEAD `b67910e` and lives in
`~/propos-backups/` — outside the repo, so it is not committed and not synced:

```
propos-schema-20260818T064107Z.sql    full pg_dump --schema-only (all schemas)
propos-data-20260818T064107Z.dump     custom-format data: public (59 tables),
                                      propos_test (59), storage (8)
propos-auth-20260818T064107Z.dump     custom-format data: auth.users, auth.identities
media-20260818T064107Z/               Storage objects + _manifest.json (path, bytes)
before-20260818T064107Z.txt           pre-run state: anon exposure probe, Cloud Run revision
```

Reproduce it the same way. The connection is the pooler URL plus the password
from `.env` — the same pair `make query` and `make migrate` use:

```bash
POOLER=$(cat supabase/.temp/pooler-url)                        # postgresql://user@host:port/db
export PGPASSWORD=$(grep '^SUPABASE_DB_PASSWORD=' .env | cut -d= -f2- | tr -d "'\"")
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p ~/propos-backups

pg_dump "$POOLER" --schema-only            > ~/propos-backups/propos-schema-$STAMP.sql
pg_dump "$POOLER" --data-only -Fc \
        -n public -n propos_test -n storage > ~/propos-backups/propos-data-$STAMP.dump
pg_dump "$POOLER" --data-only -Fc \
        -t auth.users -t auth.identities    > ~/propos-backups/propos-auth-$STAMP.dump
```

Storage objects are **not** in any of those dumps — `storage.objects` rows are
metadata, the bytes live in S3. Download the buckets separately (`documents`,
`media`, `avatars`) and keep a manifest, as the `media-*/` directory above does.

Inspect a dump without restoring it: `pg_restore -l <file>.dump`.

**Restoring is not a rehearsed procedure.** Nobody has restored one of these
into a scratch project yet. Do that before you need it.

## Soft delete restore

Only these 21 tables carry `deleted_at`:

```
ads · campaigns · contacts · documents · email_accounts · email_threads · events
import_jobs · interactions · media_files · notes · opportunities · organizations
places · projects · properties · publications · reminders · tasks · transactions
workflows
```

(`people` also appears in a column listing — it is a **view** over `contacts`,
not a table.)

```sql
-- Last 24h soft-deleted contacts
SELECT id, full_name, deleted_at FROM contacts
WHERE deleted_at IS NOT NULL AND deleted_at > now() - interval '1 day';

-- Restore one
UPDATE contacts SET deleted_at = NULL WHERE id = '<uuid>';
```

Confirm the table is on the list first — the query returns zero rows either way:

```sql
SELECT 1 FROM information_schema.columns
WHERE table_schema='public' AND table_name='<table>' AND column_name='deleted_at';
```

If it is not on the list, the row is **gone**, and `audit_log` (next section) is
the only place its contents may still exist. `DELETE /api/v1/properties/{id}` is
a hard delete — that is why it is gated to dev-admin.

## Audit-log replay

27 of the 59 tables carry an audit trigger:

```
anonymous_upload_portals · anonymous_uploads · campaigns · contacts
document_assignments · document_versions · documents · email_accounts
email_threads · events · import_jobs · interactions · internal_areas
media_assets · notes · opportunities · organizations · person_aliases · places
projects · properties · publications · reminders · share_links · tasks
transactions · workflows
```

**30 tables have neither an audit trigger nor `deleted_at`**, including
`pending_proposals`, `tags`, `taggings`, `interaction_participants`,
`interaction_targets`, `profiles`, `tenants`, `tenant_memberships`,
`property_grants`, `visitor_invitations`, `workflow_steps` and every
`agent_*` / `client_*` table. A bad write to any of those leaves no trace and no
undo.

```sql
-- All audit entries for one row, newest first
SELECT op, before, after, changed_at, source, agent_session_id
FROM audit_log
WHERE table_name = 'transactions' AND row_id = '<uuid>'
ORDER BY changed_at DESC;

-- Reconstruct row state at moment T:
--   Take the most recent `after` jsonb where changed_at <= T.
--   If T is before the row's first INSERT, the row did not exist.
```

### `changed_by` is always NULL — do not read it as "nobody"

The trigger fills `changed_by` with `auth.uid()`
(`supabase/migrations/20240601000011_rename_anita_to_agent.sql:158-164`), and the
backend performs every write through the service-role client
(`backend/app/core/supabase/client.py:12-27`), where `auth.uid()` is NULL. The
column is therefore empty for **every** backend-originated change. Verified on
the live database: 6 rows in `audit_log`, 0 with `changed_by` set.

Attribution has to come from the other two columns:

- `source` — `'user'` by default, `'agent'` when the request carried
  `X-Action-Source: agent` or the `app.action_source` GUC was set.
- `agent_session_id` — set from `X-Agent-Session-Id` / `app.agent_session_id`,
  which links the change back to an `agent_sessions` row and from there to the
  user who was talking to Propo.

Do not conclude from a NULL `changed_by` that a change was automatic or
unattributed. It means nothing at all.

## Storage buckets

- `documents` (private), `media`, `avatars`.
- Storage objects are **not** covered by any Postgres backup — they are S3-backed.
- The free plan does not back them up. The `media-*/` directory in the manual
  backup above is the only copy that exists.

## Full-table rollback

With no PITR, a migration that corrupts data is recovered by restoring the
relevant tables from the latest manual dump into a scratch database, extracting
the good rows, and writing them back. Practise this on a throwaway project
before you need it, and take a fresh dump **before** running any destructive
migration:

```bash
pg_dump "$POOLER" --data-only -Fc -n public > ~/propos-backups/pre-migration-$(date -u +%Y%m%dT%H%M%SZ).dump
```

## Before an incident

- [ ] Take a manual dump before every destructive migration or bulk operation. **This is the whole backup strategy right now.**
- [ ] Restore one of the existing dumps into a scratch project, end to end, at least once. Never done.
- [ ] Decide whether the Supabase Pro plan is worth it. Everything above is a workaround for not having PITR.
- [x] Keep a copy of `SUPABASE_DB_PASSWORD` outside the repo — it is in `.env`, which is gitignored; keep a second copy in a password manager.
- [x] Emergency access path documented: pooler URL in `supabase/.temp/pooler-url` + `SUPABASE_DB_PASSWORD`, or the service-role key for the Auth Admin API.

## Out of scope (backlog)

- Scheduled logical dump to object storage. The manual procedure above is the
  interim; a cron job would remove the "whenever someone remembers" failure mode.
- Cross-region replica. Not needed at current scale.
