-- =====================================================================
-- The audit log must not be erasable by the actor it records.
--
-- `audit_log_admin_delete` let any ADMIN DELETE audit rows through
-- PostgREST with their own JWT. That is the ledger `docs/disaster-recovery.md`
-- relies on for row-level replay, so an admin could rewrite the record of
-- their own actions. No backend code deletes from audit_log (grep: the table
-- only appears in docs and in the trigger).
--
-- Retention purges, when they land, run with the service-role client, which
-- is BYPASSRLS and therefore unaffected by the absence of a DELETE policy.
--
-- Inverse kept in docs/audits/v0.1.0-r3/ROLLBACK.sql.
-- =====================================================================

DROP POLICY IF EXISTS audit_log_admin_delete ON public.audit_log;
