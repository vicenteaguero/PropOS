-- =====================================================================
-- Extend properties + create projects (kind, status, parent) +
-- project_properties join + property_snapshots (for "as of date").
-- =====================================================================

CREATE TYPE listing_kind AS ENUM ('SALE', 'RENT', 'LEASE');

CREATE TYPE project_kind AS ENUM (
  'PARCELACION', 'COMMERCIAL_RETAIL', 'RESIDENTIAL',
  'LAND_SUBDIVISION', 'OFFICE', 'INDUSTRIAL', 'OTHER'
);

CREATE TYPE project_status AS ENUM (
  'PLANNED', 'ACTIVE', 'ON_HOLD', 'CLOSED', 'ARCHIVED'
);


-- ---------------------------------------------------------------------
-- projects (new)
-- ---------------------------------------------------------------------
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind project_kind NOT NULL DEFAULT 'OTHER',
  status project_status NOT NULL DEFAULT 'ACTIVE',
  description TEXT,
  start_date DATE,
  end_date DATE,
  parent_project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  primary_place_id UUID REFERENCES places(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_projects_tenant ON projects(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_kind_status ON projects(tenant_id, kind, status);
CREATE INDEX idx_projects_name_trgm ON projects USING gin (name gin_trgm_ops);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY projects_tenant_select ON projects FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY projects_tenant_insert ON projects FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY projects_tenant_update ON projects FOR UPDATE TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY projects_tenant_delete ON projects FOR DELETE TO authenticated
  USING (tenant_id = public.get_my_tenant_id());

CREATE TRIGGER trg_projects_touch BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
SELECT public.attach_audit('projects');


-- ---------------------------------------------------------------------
-- Extend properties with rich fields
-- ---------------------------------------------------------------------
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS bedrooms SMALLINT,
  ADD COLUMN IF NOT EXISTS bathrooms SMALLINT,
  ADD COLUMN IF NOT EXISTS area_sqm NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS lot_sqm NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS list_price_cents BIGINT,
  ADD COLUMN IF NOT EXISTS currency CHAR(3) DEFAULT 'CLP',
  ADD COLUMN IF NOT EXISTS listing_kind listing_kind DEFAULT 'SALE',
  ADD COLUMN IF NOT EXISTS lat NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS lng NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS year_built SMALLINT,
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS on_market_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS off_market_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_properties_active ON properties(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_properties_project ON properties(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_status_active ON properties(tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_properties_title_trgm ON properties USING gin (title gin_trgm_ops);


-- ---------------------------------------------------------------------
-- project_properties (M2M; a property may belong to multiple projects)
-- ---------------------------------------------------------------------
CREATE TABLE project_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  role TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, property_id)
);
CREATE INDEX idx_project_properties_project ON project_properties(project_id);
CREATE INDEX idx_project_properties_property ON project_properties(property_id);

ALTER TABLE project_properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY project_properties_tenant_select ON project_properties FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY project_properties_tenant_insert ON project_properties FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY project_properties_tenant_delete ON project_properties FOR DELETE TO authenticated
  USING (tenant_id = public.get_my_tenant_id());


-- ---------------------------------------------------------------------
-- property_snapshots (point-in-time replay; trigger on status/price change)
-- ---------------------------------------------------------------------
CREATE TABLE property_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  trigger TEXT NOT NULL CHECK (trigger IN ('status_change', 'price_change', 'manual', 'daily')),
  snapshot_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_property_snapshots_property ON property_snapshots(property_id, snapshot_at DESC);
CREATE INDEX idx_property_snapshots_tenant ON property_snapshots(tenant_id, snapshot_at DESC);

ALTER TABLE property_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY property_snapshots_tenant_select ON property_snapshots FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());


CREATE OR REPLACE FUNCTION public.snapshot_property_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_trigger TEXT;
BEGIN
  IF (OLD.status IS DISTINCT FROM NEW.status) THEN
    v_trigger := 'status_change';
  ELSIF (OLD.list_price_cents IS DISTINCT FROM NEW.list_price_cents) THEN
    v_trigger := 'price_change';
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO property_snapshots (tenant_id, property_id, snapshot_at, trigger, snapshot_data)
  VALUES (NEW.tenant_id, NEW.id, now(), v_trigger, to_jsonb(OLD));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_property_snapshot AFTER UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_property_change();


-- ---------------------------------------------------------------------
-- Add project_id back-references to interaction_targets, transactions, tasks
-- (forward references resolved now that projects table exists)
-- ---------------------------------------------------------------------
ALTER TABLE interaction_targets
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_itargets_project ON interaction_targets(project_id) WHERE project_id IS NOT NULL;

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS related_project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_project ON transactions(related_project_id) WHERE related_project_id IS NOT NULL;
