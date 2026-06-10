-- ---------------------------------------------------------------------
-- Normalize the `source` CHECK constraint on agent-writable domain tables.
--
-- The agent executors (backend/app/features/agent/tools/executors.py) write
-- `source = 'agent'`, but these tables were created with
-- CHECK (source IN ('manual','anita','import')) and the anita→agent rename
-- migration (20240601000011) only fixed `audit_log`. Any agent-driven insert
-- would therefore violate the constraint.
--
-- This migration, for both `public` and the `propos_test` mirror (cloned via
-- LIKE INCLUDING CONSTRAINTS, so it carries its own copy of the old check):
--   1. normalizes any legacy 'anita' rows to 'agent'
--   2. drops the existing source CHECK (auto-generated name in propos_test)
--   3. adds CHECK (source IN ('manual','agent','import','system'))
-- ---------------------------------------------------------------------

DO $$
DECLARE
  rec RECORD;
  schemas TEXT[] := ARRAY['public', 'propos_test'];
  tbls TEXT[] := ARRAY[
    'interactions',
    'tasks',
    'transactions',
    'notes',
    'opportunities',
    'publications',
    'campaigns'
  ];
  s TEXT;
  t TEXT;
BEGIN
  FOREACH s IN ARRAY schemas LOOP
    FOREACH t IN ARRAY tbls LOOP
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = s AND table_name = t
      ) THEN
        EXECUTE format('UPDATE %I.%I SET source = ''agent'' WHERE source = ''anita''', s, t);

        FOR rec IN
          SELECT con.conname
          FROM pg_constraint con
          JOIN pg_class c ON c.oid = con.conrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = s
            AND c.relname = t
            AND con.contype = 'c'
            AND pg_get_constraintdef(con.oid) ILIKE '%source%'
        LOOP
          EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I', s, t, rec.conname);
        END LOOP;

        EXECUTE format(
          'ALTER TABLE %I.%I ADD CONSTRAINT %I CHECK (source = ANY (ARRAY[''manual'',''agent'',''import'',''system'']))',
          s, t, t || '_source_check'
        );
      END IF;
    END LOOP;
  END LOOP;
END
$$;
