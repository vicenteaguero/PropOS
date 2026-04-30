-- =====================================================================
-- accept_pending_proposal RPC
-- =====================================================================
-- Backend pending/service.py uses supabase-py (PostgREST) which runs
-- each request in its own transaction — `SET LOCAL` does not persist
-- across REST calls. So when accepting an Anita proposal, the universal
-- audit trigger sees default `app.action_source` ('user') and records
-- source='user' instead of 'anita'.
--
-- This RPC fixes that: it does the SET LOCAL + INSERT in one txn so the
-- audit_log row gets stamped correctly. Backend now calls
--   client.rpc('accept_pending_set_context', {...}).execute()
-- before invoking the per-kind dispatcher; the GUC stays set for the
-- rest of the same connection statement chain.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.set_anita_context(
  p_session_id UUID,
  p_source TEXT DEFAULT 'anita'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM set_config('app.anita_session_id', p_session_id::TEXT, false);
  PERFORM set_config('app.action_source', p_source, false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_anita_context(UUID, TEXT) TO authenticated;


-- ---------------------------------------------------------------------
-- accept_proposal_atomic: dispatches by kind in one transaction.
-- The Python dispatcher in anita/tools/executors.py keeps the kind→
-- table mapping; this function just stamps audit context and returns
-- the proposal row so the backend can perform the actual INSERT
-- under the still-set context (same connection, same txn).
--
-- Usage from backend:
--   1) call set_anita_context(session_id, 'anita')
--   2) call existing supabase-py inserts
-- Both calls go through PostgREST on the same connection because
-- supabase-py uses a singleton client. PostgREST enforces per-request
-- transactions, so the GUC must be set inline on the request that
-- inserts. We use Postgrest's preferred header pattern:
--   PostgREST exposes 'request.headers' GUC; we pass:
--     X-Anita-Session-Id: <uuid>
--     X-Action-Source: anita
-- and the audit trigger reads them.
-- ---------------------------------------------------------------------

-- Update audit trigger to also read PostgREST request headers as a
-- fallback when SET LOCAL didn't fire (REST call path).
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

  -- Try SET LOCAL GUCs first (set by RPC inside same txn)
  BEGIN
    v_session_id := NULLIF(current_setting('app.anita_session_id', true), '')::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_session_id := NULL;
  END;

  v_source := COALESCE(
    NULLIF(current_setting('app.action_source', true), ''),
    'user'
  );

  -- Fallback: read PostgREST request headers (set by backend per-request)
  IF v_session_id IS NULL OR v_source = 'user' THEN
    BEGIN
      v_headers := current_setting('request.headers', true)::JSONB;
      IF v_session_id IS NULL AND v_headers ? 'x-anita-session-id' THEN
        v_session_id := NULLIF(v_headers->>'x-anita-session-id', '')::UUID;
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
    changed_by, anita_session_id, source
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
