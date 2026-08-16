-- =====================================================================
-- propos_test: re-grant to the post-rename readonly role.
--
-- 20240601000002_propos_test_schema.sql granted USAGE/SELECT on propos_test
-- to `anita_readonly`. 20240601000011_rename_anita_to_agent.sql then renamed
-- that role to `agent_readonly` but only re-applied its grants on `public`, so
-- the test schema kept a grant to a role that no longer exists.
--
-- The table mirror itself is no longer maintained here — it drifted three
-- months behind `public` because every later migration only touched `public`.
-- It is rebuilt from the live structure by:
--     make test-schema-rebuild
-- This migration only fixes the grants, so a clean `supabase db push` leaves
-- the schema usable without depending on that script having been run.
-- =====================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'propos_test') THEN
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'agent_readonly') THEN
    GRANT USAGE ON SCHEMA propos_test TO agent_readonly;
    GRANT SELECT ON ALL TABLES IN SCHEMA propos_test TO agent_readonly;
    ALTER DEFAULT PRIVILEGES IN SCHEMA propos_test GRANT SELECT ON TABLES TO agent_readonly;
  END IF;

  -- Idempotent restatement of the grants the mirror needs; the rebuild script
  -- applies the same set.
  GRANT USAGE ON SCHEMA propos_test TO service_role, authenticated, anon;
  GRANT ALL ON ALL TABLES IN SCHEMA propos_test TO service_role;
  GRANT SELECT ON ALL TABLES IN SCHEMA propos_test TO authenticated, anon;
  ALTER DEFAULT PRIVILEGES IN SCHEMA propos_test GRANT ALL ON TABLES TO service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA propos_test GRANT SELECT ON TABLES TO authenticated, anon;
END
$$;
