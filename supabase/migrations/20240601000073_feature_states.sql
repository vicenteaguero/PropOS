-- Per-tenant maturity state for a feature, independent of who may use it.
--
-- Until now the app had exactly one lever: `admin_scope`, a per-user whitelist
-- read by `require_scope` on the API and by `filterByScope` in the nav. That
-- answers "is this person allowed?". It cannot answer "is this thing finished?"
-- -- and using it for the second question means turning a half-built screen off
-- requires editing every user, one at a time, and turning it back on means
-- remembering exactly whose scope you narrowed.
--
-- The two axes stay separate and are intersected at read time: a feature has to
-- be enabled for the tenant AND permitted for the user.
--
-- Four states, because "on/off" is not enough for software being shown to its
-- first real users:
--   on      normal
--   wip     usable, but labelled so nobody mistakes it for finished
--   locked  visible and inert -- the user sees it exists and why it is closed
--   hidden  absent, and the API refuses as if the route did not exist
--
-- `hidden` and `locked` both refuse at the API (423), so the state is not a
-- cosmetic filter someone bypasses by typing the URL.

CREATE TYPE feature_state AS ENUM ('on', 'wip', 'locked', 'hidden');

CREATE TABLE IF NOT EXISTS feature_states (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL means "the default for every tenant". A tenant row overrides it.
  tenant_id  UUID REFERENCES tenants(id) ON DELETE CASCADE,
  key        TEXT NOT NULL,
  state      feature_state NOT NULL DEFAULT 'on',
  -- Shown to the user on the locked screen and in the WIP pill, so it is
  -- Spanish product copy, not an internal note.
  note       TEXT,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per (scope, key). A plain UNIQUE would not constrain the global rows,
-- because NULL never equals NULL -- so the global scope gets a sentinel.
CREATE UNIQUE INDEX IF NOT EXISTS idx_feature_states_scope_key
  ON feature_states (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), key);

CREATE INDEX IF NOT EXISTS idx_feature_states_tenant
  ON feature_states (tenant_id);

ALTER TABLE feature_states ENABLE ROW LEVEL SECURITY;

-- Readable by any member of the tenant, plus the global defaults: the frontend
-- has to know a feature is locked in order to draw it as locked. Writes are
-- dev-admin only and go through the service role, so no write policy is granted
-- to `authenticated` -- an ordinary session cannot unlock its own feature.
CREATE POLICY feature_states_tenant_select ON feature_states FOR SELECT TO authenticated
  USING (tenant_id IS NULL OR tenant_id = public.get_my_tenant_id());

COMMENT ON TABLE feature_states IS
  'Per-tenant feature maturity (on/wip/locked/hidden). Intersected with '
  'profiles.admin_scope at read time: the tenant decides what is ready, the '
  'scope decides who may use it.';
