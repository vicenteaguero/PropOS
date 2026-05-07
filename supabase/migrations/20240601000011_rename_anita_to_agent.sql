-- =====================================================================
-- Rename Anita → Agent (data layer)
-- =====================================================================
-- Generic naming so the AI assistant identity is configurable per tenant
-- (tenants.settings.ai_assistant_name) instead of hardcoded "Anita".
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------
ALTER TABLE anita_sessions    RENAME TO agent_sessions;
ALTER TABLE anita_messages    RENAME TO agent_messages;
ALTER TABLE anita_transcripts RENAME TO agent_transcripts;
ALTER TABLE anita_tool_calls  RENAME TO agent_tool_calls;

-- ---------------------------------------------------------------------
-- 2. Columns + audit_log.source CHECK
-- ---------------------------------------------------------------------
ALTER TABLE pending_proposals
  RENAME COLUMN anita_session_id TO agent_session_id;

ALTER TABLE audit_log
  RENAME COLUMN anita_session_id TO agent_session_id;

ALTER TABLE audit_log DROP CONSTRAINT audit_log_source_check;
UPDATE audit_log SET source = 'agent' WHERE source = 'anita';
ALTER TABLE audit_log ADD CONSTRAINT audit_log_source_check
  CHECK (source IN ('user', 'agent', 'system', 'migration'));

-- ---------------------------------------------------------------------
-- 3. Indexes (Postgres does NOT auto-rename indexes on table rename)
-- ---------------------------------------------------------------------
ALTER INDEX IF EXISTS idx_anita_sessions_user            RENAME TO idx_agent_sessions_user;
ALTER INDEX IF EXISTS idx_anita_sessions_tenant          RENAME TO idx_agent_sessions_tenant;
ALTER INDEX IF EXISTS idx_anita_sessions_external_thread RENAME TO idx_agent_sessions_external_thread;
ALTER INDEX IF EXISTS idx_anita_messages_session         RENAME TO idx_agent_messages_session;
ALTER INDEX IF EXISTS idx_anita_messages_tenant          RENAME TO idx_agent_messages_tenant;
ALTER INDEX IF EXISTS uniq_anita_messages_external       RENAME TO uniq_agent_messages_external;
ALTER INDEX IF EXISTS anita_messages_unprocessed_media_idx RENAME TO agent_messages_unprocessed_media_idx;
ALTER INDEX IF EXISTS idx_anita_transcripts_session      RENAME TO idx_agent_transcripts_session;
ALTER INDEX IF EXISTS idx_anita_transcripts_tenant       RENAME TO idx_agent_transcripts_tenant;
ALTER INDEX IF EXISTS idx_anita_tool_calls_message       RENAME TO idx_agent_tool_calls_message;
ALTER INDEX IF EXISTS idx_anita_tool_calls_tenant        RENAME TO idx_agent_tool_calls_tenant;
ALTER INDEX IF EXISTS idx_anita_tool_calls_proposal      RENAME TO idx_agent_tool_calls_proposal;

-- Partial index needs full rebuild (WHERE clause references value 'anita')
DROP INDEX IF EXISTS idx_audit_anita;
CREATE INDEX idx_audit_agent
  ON audit_log(tenant_id, agent_session_id, changed_at DESC)
  WHERE source = 'agent';

-- ---------------------------------------------------------------------
-- 4. RLS policies — drop old names, recreate with agent_* names
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS anita_sessions_own_select ON agent_sessions;
DROP POLICY IF EXISTS anita_sessions_own_insert ON agent_sessions;
DROP POLICY IF EXISTS anita_sessions_own_update ON agent_sessions;

CREATE POLICY agent_sessions_own_select ON agent_sessions FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id() AND user_id = auth.uid());
CREATE POLICY agent_sessions_own_insert ON agent_sessions FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id() AND user_id = auth.uid());
CREATE POLICY agent_sessions_own_update ON agent_sessions FOR UPDATE TO authenticated
  USING (tenant_id = public.get_my_tenant_id() AND user_id = auth.uid())
  WITH CHECK (tenant_id = public.get_my_tenant_id() AND user_id = auth.uid());

DROP POLICY IF EXISTS anita_messages_own_select ON agent_messages;
DROP POLICY IF EXISTS anita_messages_own_insert ON agent_messages;

CREATE POLICY agent_messages_own_select ON agent_messages FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_my_tenant_id()
    AND EXISTS (
      SELECT 1 FROM agent_sessions s
      WHERE s.id = session_id AND s.user_id = auth.uid()
    )
  );
CREATE POLICY agent_messages_own_insert ON agent_messages FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id());

DROP POLICY IF EXISTS anita_transcripts_tenant_select ON agent_transcripts;
DROP POLICY IF EXISTS anita_transcripts_tenant_insert ON agent_transcripts;

CREATE POLICY agent_transcripts_tenant_select ON agent_transcripts FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY agent_transcripts_tenant_insert ON agent_transcripts FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id());

DROP POLICY IF EXISTS anita_tool_calls_tenant_select ON agent_tool_calls;
DROP POLICY IF EXISTS anita_tool_calls_tenant_insert ON agent_tool_calls;

CREATE POLICY agent_tool_calls_tenant_select ON agent_tool_calls FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY agent_tool_calls_tenant_insert ON agent_tool_calls FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id());

-- ---------------------------------------------------------------------
-- 5. log_audit() — read agent_* GUC + header, write to agent_session_id
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row_id UUID;
  v_tenant_id UUID;
  v_before JSONB;
  v_after JSONB;
  v_session_id UUID;
  v_source TEXT;
  v_headers JSONB;
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
    auth.uid(), v_session_id, v_source
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------
-- 6. set_anita_context → set_agent_context
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.set_anita_context(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.set_agent_context(
  p_session_id UUID,
  p_source TEXT DEFAULT 'agent'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM set_config('app.agent_session_id', p_session_id::TEXT, false);
  PERFORM set_config('app.action_source', p_source, false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_agent_context(UUID, TEXT) TO authenticated;

-- ---------------------------------------------------------------------
-- 7. Postgres role: anita_readonly → agent_readonly
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anita_readonly')
     AND NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'agent_readonly') THEN
    EXECUTE 'ALTER ROLE anita_readonly RENAME TO agent_readonly';
  ELSIF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'agent_readonly') THEN
    EXECUTE 'CREATE ROLE agent_readonly LOGIN';
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO agent_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO agent_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO agent_readonly;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM agent_readonly;
ALTER ROLE agent_readonly SET statement_timeout = '3s';
ALTER ROLE agent_readonly NOBYPASSRLS;

COMMIT;
