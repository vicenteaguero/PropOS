-- =====================================================================
-- text_to_sql returned zero rows in production, and would have returned
-- every tenant's rows the moment it worked. Both halves fixed here.
--
-- A) Least privilege. 20240601000011:210 granted `agent_readonly`
--    SELECT ON ALL TABLES plus default privileges. In Postgres ALL TABLES
--    includes views and materialized views. The role is NOBYPASSRLS, so base
--    tables correctly returned nothing -- but the five `mv_*` cannot carry RLS
--    at all, so a query against them would have returned every tenant.
--    (20240601000044 already revoked the matviews; this makes the whole grant
--    an allowlist instead of a denylist.) `_EXPOSED_TABLES` in
--    agent/tools/text_to_sql.py was only ever a prompt hint -- sql_guard never
--    consulted it. Now it is a real grant boundary.
--
-- B) Visibility. Every policy in the database is `TO authenticated`, so a
--    NOBYPASSRLS role with no policy of its own matches nothing and every
--    query comes back empty -- which the agent reports to the user as
--    "consulté la base y no hay resultados", a false answer rather than an
--    error.
--
--    The policies below key on `public.get_my_tenant_id()`, which reads
--    `app.current_tenant_id` first (20240601000024:11-27). Its fallback is
--    `profiles WHERE id = auth.uid()`, and auth.uid() reads the `sub` claim
--    that query_sql.py never sets -- so the GUC is the only workable path.
--    agent/tools/query_sql.py sets it in the same commit as this migration;
--    without that line this file is inert.
-- =====================================================================

DO $$
DECLARE
  t TEXT;
  exposed TEXT[] := ARRAY[
    'properties','contacts','organizations','interactions','interaction_participants',
    'interaction_targets','tasks','transactions','projects','project_properties',
    'campaigns','documents','notes','tags','taggings','pending_proposals'
  ];
BEGIN
  -- A) drop the blanket grant, then re-grant only the allowlist
  REVOKE SELECT ON ALL TABLES IN SCHEMA public FROM agent_readonly;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT ON TABLES FROM agent_readonly;

  FOREACH t IN ARRAY exposed LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name=t AND column_name='tenant_id'
    ) THEN
      RAISE EXCEPTION 'table %.% has no tenant_id column; refusing to expose it', 'public', t;
    END IF;

    EXECUTE format('GRANT SELECT ON public.%I TO agent_readonly', t);

    -- B) the role needs a policy of its own; every existing one is TO authenticated
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO agent_readonly USING (tenant_id = public.get_my_tenant_id())',
      t || '_agent_ro_select', t
    );
  END LOOP;

  -- `people` is a view over `contacts` (20240101000022:75). Since
  -- 20240601000044 it runs with security_invoker, so it inherits the policy
  -- above instead of needing one of its own.
  GRANT SELECT ON public.people TO agent_readonly;
END
$$;

GRANT EXECUTE ON FUNCTION public.get_my_tenant_id() TO agent_readonly;
