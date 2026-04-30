# Disaster recovery — PropOS

## Backup tiers

1. **Supabase Point-in-Time Recovery (PITR)** — primary defence.
   - Pro plan: 7 days retention.
   - Verify: Supabase Dashboard → Settings → Database → Backups.
   - **If current plan does NOT include PITR ≥7 days, upgrade BEFORE relying on this.**
2. **Daily automated backups** (Supabase Pro+) — full snapshot, 7 days retention.
3. **Soft delete on all domain tables** (`deleted_at TIMESTAMPTZ`).
   - Restore: `UPDATE <table> SET deleted_at = NULL WHERE id = '...';`
   - Audit log captures the restore.
4. **`audit_log` universal table** — every INSERT/UPDATE/DELETE on every domain table is journaled with `before` + `after` JSONB. Use to reconstruct any row state.

## Soft delete restore (most common)

```sql
-- Last 24h soft-deleted contacts
SELECT id, full_name, deleted_at FROM contacts
WHERE deleted_at IS NOT NULL AND deleted_at > now() - interval '1 day';

-- Restore one
UPDATE contacts SET deleted_at = NULL WHERE id = '<uuid>';
```

## Audit-log replay (point-in-time row state)

```sql
-- Get all audit entries for one row, newest first
SELECT op, before, after, changed_at, source, changed_by
FROM audit_log
WHERE table_name = 'transactions' AND row_id = '<uuid>'
ORDER BY changed_at DESC;

-- Reconstruct row state at moment T:
--   Take the most recent `after` jsonb where changed_at <= T.
--   If T is before the row's first INSERT, the row didn't exist.
```

## Full-table rollback (emergency)

If a migration corrupted data, the only safe path is **Supabase PITR restore** to a moment before the corruption.

1. Supabase Dashboard → Database → Backups → Restore.
2. Pick timestamp before incident.
3. Restoration creates a new project; you migrate connection strings or do a logical dump+import.
4. **Test on a staging project first** if data volume is non-trivial.

## Storage buckets

- `documents` (private) and `media` (public) buckets in Supabase Storage.
- Storage objects are **NOT** covered by Postgres PITR — they're S3-backed.
- Supabase has separate storage backup retention; verify in dashboard.
- For critical document recovery: enable **versioning at the storage layer** if Supabase exposes it on your tier.

## What to do BEFORE incident

- [ ] Confirm Supabase plan includes PITR ≥7 days.
- [ ] Verify automated daily backups are enabled.
- [ ] Test a PITR restore drill on a throwaway project once a quarter.
- [ ] Document the steps for `supabase link` + service-role key for emergency access.
- [ ] Keep a copy of `SUPABASE_DB_PASSWORD` somewhere outside the repo (1Password, etc).

## Out of scope (backlog)

- Weekly logical dump (`pg_dump` → R2/S3). Cron job not yet implemented; defer until the team grows beyond Vicente.
- Cross-region replica. Not needed at current scale.
