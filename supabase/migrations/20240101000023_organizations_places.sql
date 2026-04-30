-- =====================================================================
-- Organizations (notarías, portales inmobiliarios, ANAIDA, CETER, agencias)
-- + Places (lugares físicos: notaría addresses, project sites, etc)
-- =====================================================================

CREATE TYPE organization_kind AS ENUM (
  'NOTARY', 'PORTAL', 'GOV', 'BANK', 'AGENCY', 'BROKERAGE',
  'CONTRACTOR', 'SUPPLIER', 'OTHER'
);


-- ---------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind organization_kind NOT NULL DEFAULT 'OTHER',
  rut TEXT,
  website TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_organizations_tenant ON organizations(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_organizations_kind ON organizations(tenant_id, kind);
CREATE INDEX idx_organizations_name_trgm ON organizations USING gin (name gin_trgm_ops);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY organizations_tenant_select ON organizations FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY organizations_tenant_insert ON organizations FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY organizations_tenant_update ON organizations FOR UPDATE TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY organizations_tenant_delete ON organizations FOR DELETE TO authenticated
  USING (tenant_id = public.get_my_tenant_id());

CREATE TRIGGER trg_organizations_touch BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
SELECT public.attach_audit('organizations');


-- ---------------------------------------------------------------------
-- places
-- ---------------------------------------------------------------------
CREATE TABLE places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  region TEXT,
  country TEXT DEFAULT 'CL',
  lat NUMERIC(10, 7),
  lng NUMERIC(10, 7),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_places_tenant ON places(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_places_name_trgm ON places USING gin (name gin_trgm_ops);

ALTER TABLE places ENABLE ROW LEVEL SECURITY;
CREATE POLICY places_tenant_select ON places FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY places_tenant_insert ON places FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY places_tenant_update ON places FOR UPDATE TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY places_tenant_delete ON places FOR DELETE TO authenticated
  USING (tenant_id = public.get_my_tenant_id());

CREATE TRIGGER trg_places_touch BEFORE UPDATE ON places
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
SELECT public.attach_audit('places');
