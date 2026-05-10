-- =====================================================================
-- Multi-tenancy: tenant_memberships pivot + user_view enum
--
-- One person can be member of N tenants with a specific role/scope/view
-- per tenant. Source of truth for access. profiles.tenant_id/role/
-- admin_scope/is_dev_admin/view remain as a denorm snapshot of the
-- currently active tenant — kept in sync by activate_tenant() — so
-- existing RLS policies (which read profiles.*) keep working without
-- a schema-wide rewrite. Future PR may eliminate the snapshot when
-- policies migrate to read tenant_memberships directly.
-- =====================================================================

CREATE TYPE user_view AS ENUM ('admin', 'admin-dev', 'agent', 'owner', 'buyer', 'content');

CREATE TABLE IF NOT EXISTS tenant_memberships (
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id    UUID NOT NULL REFERENCES tenants(id)    ON DELETE CASCADE,
  role         user_role NOT NULL,
  admin_scope  TEXT[] NOT NULL DEFAULT '{}',
  is_dev_admin BOOLEAN NOT NULL DEFAULT false,
  view         user_view NOT NULL DEFAULT 'agent',
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS tenant_memberships_tenant_idx ON tenant_memberships(tenant_id);
CREATE INDEX IF NOT EXISTS tenant_memberships_user_idx   ON tenant_memberships(user_id);

ALTER TABLE tenant_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_memberships_self_select ON tenant_memberships FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY tenant_memberships_admin_all ON tenant_memberships FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
              AND p.tenant_id = tenant_memberships.tenant_id
              AND p.role = 'ADMIN')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'ADMIN'
              AND p.tenant_id = tenant_memberships.tenant_id)
  );

-- Backfill: one membership per existing profile (default view derived from role).
INSERT INTO tenant_memberships (user_id, tenant_id, role, admin_scope, is_dev_admin, view)
SELECT id, tenant_id, role, admin_scope, false,
  CASE role
    WHEN 'ADMIN'     THEN 'admin'::user_view
    WHEN 'AGENT'     THEN 'agent'::user_view
    WHEN 'LANDOWNER' THEN 'owner'::user_view
    WHEN 'BUYER'     THEN 'buyer'::user_view
    WHEN 'CONTENT'   THEN 'content'::user_view
  END
FROM profiles
WHERE tenant_id IS NOT NULL
ON CONFLICT (user_id, tenant_id) DO NOTHING;

COMMENT ON TABLE tenant_memberships IS
  'User × tenant pivot. Source of truth for role/admin_scope/view per tenant. profiles.* fields are denormalized snapshot of the user current/default tenant for RLS compat.';
