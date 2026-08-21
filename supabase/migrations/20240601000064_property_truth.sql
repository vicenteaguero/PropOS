-- =====================================================================
-- Which facts about a property were checked, and which were just told to us.
--
-- Right now every field on `properties` looks equally true. The 120 m² the
-- owner mentioned on the phone sits in the same column, rendered the same way,
-- as the 118.4 m² on the certificado. An assistant reading that row states both
-- with the same confidence — which is how software ends up quoting a surface
-- nobody measured to a buyer who is about to sign something.
--
-- One JSONB column rather than a sidecar table: every read of a property needs
-- it (that is the point), a join would double the cost of the hottest query in
-- the app, and the shape is per-field metadata, not rows.
--
--   {"area_sqm": {"src": "declared"},
--    "rol":      {"src": "verified", "at": "2026-08-20T…", "doc": "<uuid>"}}
--
-- Absent key = unknown, which is the honest default for everything already in
-- the table: nobody recorded where those numbers came from.
-- =====================================================================

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS provenance JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN properties.provenance IS
  'Per-field provenance: {"<field>": {"src": "verified"|"declared"|"derived", "at": ts, "doc": uuid}}. '
  'A missing key means unknown. Read by the agent guard before any figure is quoted as fact.';

-- --------------------------------------------------------------------
-- Buildings, so forty units at one address are not forty addresses.
--
-- `properties.address` is free text. Forty flats in the same tower become forty
-- spellings of one street, and nothing can group them, price them against each
-- other, or stop the same building being photographed forty times.
-- --------------------------------------------------------------------

CREATE TABLE buildings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  comuna TEXT,
  place_id UUID REFERENCES places(id) ON DELETE SET NULL,
  lat NUMERIC,
  lng NUMERIC,
  year_built SMALLINT,
  -- Shared facts the units inherit at read time: amenities, gastos comunes
  -- base, administración. Kept loose because every building has different ones.
  shared JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (tenant_id, name)
);

CREATE INDEX idx_buildings_tenant ON buildings (tenant_id) WHERE deleted_at IS NULL;

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS building_id UUID REFERENCES buildings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unit_label TEXT;

CREATE INDEX idx_properties_building ON properties (tenant_id, building_id)
  WHERE building_id IS NOT NULL;

COMMENT ON COLUMN properties.unit_label IS
  'Departamento 802, Oficina 14. Only meaningful with a building_id.';

ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;
CREATE POLICY buildings_tenant ON buildings FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id()) WITH CHECK (tenant_id = public.get_my_tenant_id());

SELECT public.attach_audit('buildings');
