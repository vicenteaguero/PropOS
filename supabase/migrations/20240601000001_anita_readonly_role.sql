-- ---------------------------------------------------------------------
-- Anita read-only role for text-to-SQL tool.
--
-- Uses Postgres role-level grants as the third defense layer (after
-- sqlglot allowlist + LIMIT cap in app code). RLS still applies because
-- the connection sets `request.jwt.claims` on session start and every
-- public.* table's policy reads `public.get_my_tenant_id()` from there.
-- ---------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anita_readonly') THEN
    -- LOGIN role with no superuser privs. Password is set out-of-band
    -- (Secret Manager → ANITA_READONLY_DB_URL).
    EXECUTE 'CREATE ROLE anita_readonly LOGIN';
  END IF;
END
$$;

-- No CREATE on the schema, only USAGE.
GRANT USAGE ON SCHEMA public TO anita_readonly;

-- SELECT on every existing public table.
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anita_readonly;

-- Future tables created in `public` should auto-grant SELECT to the role.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO anita_readonly;

-- Sequences are not needed; explicitly deny.
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anita_readonly;

-- Statement timeout default for the role (defense in depth — the
-- application also passes -c statement_timeout=3000 when connecting).
ALTER ROLE anita_readonly SET statement_timeout = '3s';

-- The role must respect RLS like any normal user.
ALTER ROLE anita_readonly NOBYPASSRLS;
