-- =====================================================================
-- properties.comuna
--
-- The deals board offers a "comuna" control that has never filtered anything,
-- because `properties` has no such column: the value lives in `metadata`
-- JSONB for some rows, in `buildings.comuna` for others, and nowhere at all
-- for the rest. The control read a map that was always empty, so every deal
-- fell into "Sin comuna" — which is indistinguishable from "the filter is
-- broken", because it was.
--
-- In Chile the comuna is the single most-used property attribute: it is how
-- listings are searched, how prices are compared and how a broker describes
-- their patch. It belongs in a column.
-- =====================================================================

ALTER TABLE properties ADD COLUMN IF NOT EXISTS comuna TEXT;

-- Backfill, most reliable source first. `metadata->>'comuna'` is what the
-- importer writes; `buildings.comuna` is what a unit inherits from its
-- building; the title is the last resort and is parsed, not guessed —
-- "Departamento 3D/3B en venta en Macul" is the shape `seed_demo` writes and
-- the one brokers type.
UPDATE properties p
SET comuna = NULLIF(TRIM(p.metadata->>'comuna'), '')
WHERE p.comuna IS NULL
  AND NULLIF(TRIM(p.metadata->>'comuna'), '') IS NOT NULL;

UPDATE properties p
SET comuna = NULLIF(TRIM(b.comuna), '')
FROM buildings b
WHERE p.building_id = b.id
  AND p.comuna IS NULL
  AND NULLIF(TRIM(b.comuna), '') IS NOT NULL;

UPDATE properties p
SET comuna = NULLIF(TRIM(substring(p.title FROM ' en (?:venta|arriendo) en (.+)$')), '')
WHERE p.comuna IS NULL
  AND p.title ~ ' en (venta|arriendo) en .+$';

-- Every filter this feeds is "this tenant's properties in this comuna".
CREATE INDEX IF NOT EXISTS idx_properties_tenant_comuna
  ON properties(tenant_id, comuna)
  WHERE deleted_at IS NULL AND comuna IS NOT NULL;

-- Keep it in step when the importer writes only `metadata`.
CREATE OR REPLACE FUNCTION public.sync_property_comuna()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.comuna IS NULL AND NEW.metadata ? 'comuna' THEN
    NEW.comuna := NULLIF(TRIM(NEW.metadata->>'comuna'), '');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_property_comuna ON properties;
CREATE TRIGGER trg_property_comuna
  BEFORE INSERT OR UPDATE OF metadata, comuna ON properties
  FOR EACH ROW EXECUTE FUNCTION public.sync_property_comuna();
