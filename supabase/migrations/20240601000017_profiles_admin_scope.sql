-- =====================================================================
-- Profiles: admin_scope text[]
--
-- Per-user whitelist of admin sub-features. Empty array (default) = full
-- admin surface. Non-empty = curated subset for "admin-lite" users.
-- Sidebar/UI filters and require_scope() dependency consume this.
-- =====================================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS admin_scope TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS profiles_admin_scope_idx
  ON profiles USING GIN (admin_scope);

COMMENT ON COLUMN profiles.admin_scope IS
  'Whitelist of admin scope tokens (e.g. agent, inbox, pendientes, documents). Empty = full admin access.';
