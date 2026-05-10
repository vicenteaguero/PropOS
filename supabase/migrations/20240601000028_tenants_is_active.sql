-- =====================================================================
-- tenants.is_active soft-delete flag
-- =====================================================================

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS tenants_is_active_idx
  ON tenants(is_active) WHERE is_active = true;

COMMENT ON COLUMN tenants.is_active IS
  'Soft-delete flag. False = tenant disabled (login blocked, dashboards hidden).';
