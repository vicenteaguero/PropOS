-- =====================================================================
-- user_emails — multi-email registry per user (admin-only feature)
--
-- Not for login — login keeps using auth.users.email (the primary).
-- Used as outbound channel registry: same person may receive mail at
-- multiple addresses with different purposes (notifications, billing,
-- marketing, all). Each row can later carry its own template/routing
-- logic.
--
-- RUT remains the unique person identifier on profiles.
-- =====================================================================

CREATE TABLE IF NOT EXISTS user_emails (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  label       TEXT,
  purpose     TEXT NOT NULL DEFAULT 'all'
              CHECK (purpose IN ('all', 'notifications', 'billing', 'marketing', 'security')),
  is_primary  BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_emails_email_unique_idx
  ON user_emails (LOWER(email));

CREATE UNIQUE INDEX IF NOT EXISTS user_emails_one_primary_per_user
  ON user_emails (user_id) WHERE is_primary;

CREATE INDEX IF NOT EXISTS idx_user_emails_user   ON user_emails (user_id);
CREATE INDEX IF NOT EXISTS idx_user_emails_tenant ON user_emails (tenant_id);

ALTER TABLE user_emails ENABLE ROW LEVEL SECURITY;

-- Admin-only by design (dev or non-dev). Regular roles have no read/write.
CREATE POLICY user_emails_admin_select ON user_emails FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.tenant_id = user_emails.tenant_id
        AND p.role = 'ADMIN'
    )
  );

CREATE POLICY user_emails_admin_write ON user_emails FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.tenant_id = user_emails.tenant_id
        AND p.role = 'ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.tenant_id = user_emails.tenant_id
        AND p.role = 'ADMIN'
    )
  );

COMMENT ON TABLE  user_emails IS
  'Outbound email channels per user. Not used for login. Admin-only RLS.';
COMMENT ON COLUMN user_emails.label   IS 'Free-form label (e.g. anaida, ceter, personal).';
COMMENT ON COLUMN user_emails.purpose IS 'Routing intent: all|notifications|billing|marketing|security.';
