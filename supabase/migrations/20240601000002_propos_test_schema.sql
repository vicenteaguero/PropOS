-- ---------------------------------------------------------------------
-- propos_test: schema mirror of public for integration tests.
--
-- Same DB, different schema — PostgREST routes via Accept-Profile when
-- the supabase client is built with `ClientOptions(schema="propos_test")`.
-- Tests use a unique tenant_id per session and clean up by tenant_id;
-- this schema isolation prevents accidental writes to prod-shape rows.
--
-- Tables are cloned with `LIKE … INCLUDING ALL` (defaults, constraints,
-- indexes, generated cols). Foreign keys are intentionally NOT recreated
-- — tests don't exercise referential integrity, and skipping them keeps
-- the schema independent (no cross-schema FKs).
--
-- Add the schema to PostgREST exposed schemas via supabase config or
-- `db.schemas` setting; the dashboard will then list `propos_test`.
-- ---------------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS propos_test;

-- Allow service_role + authenticated to use it.
GRANT USAGE ON SCHEMA propos_test TO service_role, authenticated, anon;

-- Tables we seed for Anita tests. Order doesn't matter (no FKs).
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'tenants',
    'contacts',
    'properties',
    'projects',
    'organizations',
    'places',
    'interactions',
    'interaction_targets',
    'interaction_participants',
    'tasks',
    'transactions',
    'campaigns',
    'ads',
    'publications',
    'pipelines',
    'opportunities',
    'opportunity_stage_history',
    'tags',
    'taggings',
    'notes',
    'workflows',
    'workflow_steps',
    'audit_log',
    'pending_proposals',
    'anita_sessions',
    'anita_messages',
    'anita_transcripts',
    'anita_tool_calls'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Only mirror if the source exists and the mirror does not yet.
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'propos_test' AND table_name = t
    ) THEN
      EXECUTE format(
        'CREATE TABLE propos_test.%I (LIKE public.%I INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES INCLUDING GENERATED INCLUDING IDENTITY)',
        t, t
      );
    END IF;
  END LOOP;
END
$$;

-- Grant rights on test tables (no RLS — tenant scoping handled by tests).
GRANT ALL ON ALL TABLES IN SCHEMA propos_test TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA propos_test TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA propos_test
  GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA propos_test
  GRANT SELECT ON TABLES TO authenticated;

-- Anita readonly role gets SELECT on the test schema too (used by the
-- query_sql tool when ANITA_READONLY_DB_URL targets this schema).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anita_readonly') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA propos_test TO anita_readonly';
    EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA propos_test TO anita_readonly';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA propos_test GRANT SELECT ON TABLES TO anita_readonly';
  END IF;
END
$$;
