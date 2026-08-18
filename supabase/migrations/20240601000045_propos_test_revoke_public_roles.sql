-- =====================================================================
-- `propos_test` was readable by anyone on the internet.
--
-- The mirror schema is exposed through PostgREST (supabase/config.toml
-- `[api] schemas`) so the integration suite can route to it. Both
-- 20240601000002 and 20240601000043 granted SELECT on it to `anon` and
-- `authenticated`, and the mirror is built with `CREATE TABLE ... (LIKE ...)`
-- which copies no RLS and no policies. Net effect, verified live: a request
-- carrying only the publishable key plus `Accept-Profile: propos_test` read
-- `propos_test.audit_log` and got rows back. The integration suite repopulates
-- that table on every run.
--
-- The seal is the grant, not the exposure: PostgREST still routes the schema
-- (the suite's probe in tests/integration/agent/conftest.py uses the
-- service-role client, which keeps its grants), but Postgres now answers
-- `42501 permission denied` to anon and authenticated.
--
-- `agent_readonly` keeps SELECT: it is the login used by text_to_sql tests.
-- =====================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'propos_test') THEN
    RETURN;
  END IF;

  REVOKE ALL ON ALL TABLES    IN SCHEMA propos_test FROM anon, authenticated;
  REVOKE ALL ON ALL FUNCTIONS IN SCHEMA propos_test FROM anon, authenticated;
  REVOKE ALL ON ALL SEQUENCES IN SCHEMA propos_test FROM anon, authenticated;
  REVOKE USAGE ON SCHEMA propos_test FROM anon, authenticated;

  ALTER DEFAULT PRIVILEGES IN SCHEMA propos_test REVOKE ALL ON TABLES    FROM anon, authenticated;
  ALTER DEFAULT PRIVILEGES IN SCHEMA propos_test REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
  ALTER DEFAULT PRIVILEGES IN SCHEMA propos_test REVOKE ALL ON SEQUENCES FROM anon, authenticated;
END
$$;
