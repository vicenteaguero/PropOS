-- =====================================================================
-- SECURITY DEFINER hardening.
--
-- Verified against the live catalog before writing this:
--   set_agent_context  EXECUTE granted to PUBLIC, anon, authenticated; no
--                      fixed search_path; set_config(..., false) = SESSION
--                      scope on pooled connections; p_source unvalidated.
--                      Zero callers in the repo.
--   refresh_analytics  EXECUTE granted to PUBLIC and anon. Any anonymous
--                      caller could fire five REFRESH MATERIALIZED VIEW
--                      CONCURRENTLY through PostgREST -- a free DoS.
--   log_audit          SECURITY DEFINER with no fixed search_path, and
--                      changed_by is auth.uid(), which is NULL for every
--                      service-role write, i.e. all of them.
--
-- set_agent_context is disarmed rather than dropped: rebuild_test_schema.py
-- clones functions from pg_proc, and an asymmetric catalog is more expensive
-- to chase than a revoked function. The real attribution path is the
-- X-Agent-Session-Id / X-Action-Source header pair.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.set_agent_context(p_session_id UUID, p_source TEXT DEFAULT 'agent')
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF p_source NOT IN ('user', 'agent', 'system', 'migration') THEN
    RAISE EXCEPTION 'invalid action source: %', p_source
      USING HINT = 'audit_log.source only accepts user, agent, system, migration';
  END IF;
  -- `true` = transaction-local. The previous `false` set it for the whole
  -- session, which leaks across requests on a pooled connection.
  PERFORM set_config('app.agent_session_id', p_session_id::TEXT, true);
  PERFORM set_config('app.action_source', p_source, true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_agent_context(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_analytics()          FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.refresh_analytics()          TO service_role;

CREATE OR REPLACE FUNCTION public.log_audit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_row_id UUID;
  v_tenant_id UUID;
  v_before JSONB;
  v_after JSONB;
  v_session_id UUID;
  v_source TEXT;
  v_headers JSONB;
  v_changed_by UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_row_id := OLD.id;
    v_tenant_id := OLD.tenant_id;
    v_before := to_jsonb(OLD);
    v_after := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    v_row_id := NEW.id;
    v_tenant_id := NEW.tenant_id;
    v_before := NULL;
    v_after := to_jsonb(NEW);
  ELSE
    v_row_id := NEW.id;
    v_tenant_id := NEW.tenant_id;
    v_before := to_jsonb(OLD);
    v_after := to_jsonb(NEW);
  END IF;

  BEGIN
    v_session_id := NULLIF(current_setting('app.agent_session_id', true), '')::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_session_id := NULL;
  END;

  v_source := COALESCE(
    NULLIF(current_setting('app.action_source', true), ''),
    'user'
  );

  IF v_session_id IS NULL OR v_source = 'user' THEN
    BEGIN
      v_headers := current_setting('request.headers', true)::JSONB;
      IF v_session_id IS NULL AND v_headers ? 'x-agent-session-id' THEN
        v_session_id := NULLIF(v_headers->>'x-agent-session-id', '')::UUID;
      END IF;
      IF v_headers ? 'x-action-user' THEN
        v_changed_by := NULLIF(v_headers->>'x-action-user', '')::UUID;
      END IF;
      IF v_source = 'user' AND v_headers ? 'x-action-source' THEN
        v_source := COALESCE(NULLIF(v_headers->>'x-action-source', ''), v_source);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  INSERT INTO audit_log (
    tenant_id, table_name, row_id, op, before, after,
    changed_by, agent_session_id, source
  ) VALUES (
    v_tenant_id, TG_TABLE_NAME, v_row_id, TG_OP, v_before, v_after,
    COALESCE(auth.uid(), v_changed_by), v_session_id, v_source
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$function$;
