-- =====================================================================
-- Profiles: denorm snapshot of current tenant's view + is_dev_admin
--
-- These columns mirror tenant_memberships(view, is_dev_admin) for the
-- tenant the user has currently activated. Maintained in sync by the
-- activate_tenant() SQL function. Frontend reads profiles.view to pick
-- UI shell; backend deps read profiles.is_dev_admin for require_dev_admin.
-- =====================================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_dev_admin BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS view         user_view NOT NULL DEFAULT 'agent';

-- Normalize any pre-existing RUT values that contain dots (legacy format
-- from before the format CHECK was added in 0020). Without this, the
-- view UPDATE below triggers row re-validation and fails on dotted RUTs.
UPDATE profiles SET rut = REPLACE(rut, '.', '')
WHERE rut IS NOT NULL AND rut LIKE '%.%';

-- Backfill view from role for existing profiles (only if still default).
UPDATE profiles SET view = CASE role
  WHEN 'ADMIN'     THEN 'admin'::user_view
  WHEN 'AGENT'     THEN 'agent'::user_view
  WHEN 'LANDOWNER' THEN 'owner'::user_view
  WHEN 'BUYER'     THEN 'buyer'::user_view
  WHEN 'CONTENT'   THEN 'content'::user_view
END
WHERE view = 'agent';

COMMENT ON COLUMN profiles.is_dev_admin IS
  'Denorm snapshot of tenant_memberships.is_dev_admin for current tenant.';
COMMENT ON COLUMN profiles.view IS
  'Denorm snapshot of tenant_memberships.view for current tenant. Frontend uses this to pick UI shell.';
