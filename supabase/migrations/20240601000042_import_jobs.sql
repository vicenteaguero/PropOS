-- =====================================================================
-- import_jobs: dry-run-first CSV import staging. Rows are validated and held
-- in `rows` (JSONB) for preview, then committed with source='import'.
-- =====================================================================

CREATE TABLE import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity TEXT NOT NULL CHECK (entity IN ('contacts', 'transactions')),
  filename TEXT,
  status TEXT NOT NULL DEFAULT 'PREVIEW' CHECK (status IN ('PREVIEW', 'COMMITTED', 'FAILED', 'DISCARDED')),
  mapping JSONB NOT NULL DEFAULT '{}'::JSONB,
  rows JSONB NOT NULL DEFAULT '[]'::JSONB,
  total_rows INT,
  valid_rows INT,
  inserted_rows INT,
  errors JSONB NOT NULL DEFAULT '[]'::JSONB,
  committed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_import_jobs_tenant ON import_jobs(tenant_id, created_at DESC) WHERE deleted_at IS NULL;

ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY import_jobs_tenant ON import_jobs FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id()) WITH CHECK (tenant_id = public.get_my_tenant_id());

CREATE TRIGGER trg_import_jobs_touch BEFORE UPDATE ON import_jobs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
SELECT public.attach_audit('import_jobs');
