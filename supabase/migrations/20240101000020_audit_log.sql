-- =====================================================================
-- Universal audit log infrastructure (Anita data management)
-- =====================================================================
-- - audit_log table: insert/update/delete history for every domain table
-- - log_audit() trigger function: generic, reads TG_TABLE_NAME / NEW / OLD
-- - attach_audit(table) helper: invoked by subsequent migrations
-- - Session settings consumed via SET LOCAL from backend services:
--     app.anita_session_id (UUID, nullable)
--     app.action_source    ('user' | 'anita' | 'system' | 'migration')
-- =====================================================================


-- ---------------------------------------------------------------------
-- audit_log table
-- ---------------------------------------------------------------------
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL,
  row_id UUID NOT NULL,
  op TEXT NOT NULL CHECK (op IN ('INSERT', 'UPDATE', 'DELETE')),
  before JSONB,
  after JSONB,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL DEFAULT 'user'
    CHECK (source IN ('user', 'anita', 'system', 'migration')),
  anita_session_id UUID,
  reason TEXT
);
CREATE INDEX idx_audit_tenant_row ON audit_log(tenant_id, table_name, row_id, changed_at DESC);
CREATE INDEX idx_audit_anita ON audit_log(tenant_id, anita_session_id, changed_at DESC)
  WHERE source = 'anita';
CREATE INDEX idx_audit_tenant_changed ON audit_log(tenant_id, changed_at DESC);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_log_tenant_select ON audit_log FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());

-- Backend (service-role) is the only writer; trigger runs as the SQL caller
-- (which IS service-role in our setup). Authenticated users cannot insert.
CREATE POLICY audit_log_admin_delete ON audit_log FOR DELETE TO authenticated
  USING (
    tenant_id = public.get_my_tenant_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'ADMIN'
    )
  );


-- ---------------------------------------------------------------------
-- log_audit() trigger function
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

  -- Anita session context (set by backend via SET LOCAL)
  BEGIN
    v_session_id := NULLIF(current_setting('app.anita_session_id', true), '')::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_session_id := NULL;
  END;

  v_source := COALESCE(
    NULLIF(current_setting('app.action_source', true), ''),
    'user'
  );

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


-- ---------------------------------------------------------------------
-- attach_audit(table) helper — invoked by every domain table migration
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.attach_audit(p_table TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE format(
    'DROP TRIGGER IF EXISTS trg_audit_%I ON %I',
    p_table, p_table
  );
  EXECUTE format(
    'CREATE TRIGGER trg_audit_%I '
    'AFTER INSERT OR UPDATE OR DELETE ON %I '
    'FOR EACH ROW EXECUTE FUNCTION public.log_audit()',
    p_table, p_table
  );
END;
$$;


-- ---------------------------------------------------------------------
-- Attach audit to existing domain tables (Documents v1)
-- ---------------------------------------------------------------------
SELECT public.attach_audit('properties');
SELECT public.attach_audit('contacts');
SELECT public.attach_audit('internal_areas');
SELECT public.attach_audit('documents');
SELECT public.attach_audit('document_versions');
SELECT public.attach_audit('document_assignments');
SELECT public.attach_audit('share_links');
SELECT public.attach_audit('anonymous_upload_portals');
SELECT public.attach_audit('anonymous_uploads');
