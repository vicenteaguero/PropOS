-- =====================================================================
-- Visitor invitations — admin generates registration links for visitors
-- =====================================================================
-- Plan v4. Admin (rol=ADMIN) creates an invitation tied to a property and
-- emails it to the visitor via Resend. Visitor opens public slug, fills
-- the form, scans cédula, accepts consent, and is registered as a contact
-- (visitor_only) or full auth user (auth_user). Tenant-scoped via RLS.
-- =====================================================================

CREATE TABLE visitor_invitations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  slug                TEXT NOT NULL UNIQUE,
  email               TEXT NOT NULL,
  property_id         UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  mode                TEXT NOT NULL CHECK (mode IN ('visitor_only', 'auth_user')),
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'opened', 'completed', 'expired')),
  contact_id          UUID REFERENCES contacts(id) ON DELETE SET NULL,
  user_id             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  id_document_id      UUID REFERENCES documents(id) ON DELETE SET NULL,
  expires_at          TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  created_by          UUID REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  opened_at           TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  last_email_sent_at  TIMESTAMPTZ
);

CREATE INDEX visitor_invitations_tenant_idx   ON visitor_invitations(tenant_id);
CREATE INDEX visitor_invitations_slug_idx     ON visitor_invitations(slug);
CREATE INDEX visitor_invitations_status_idx   ON visitor_invitations(tenant_id, status);
CREATE INDEX visitor_invitations_property_idx ON visitor_invitations(property_id);

ALTER TABLE visitor_invitations ENABLE ROW LEVEL SECURITY;

-- Admin del tenant ve y muta sus invitaciones.
CREATE POLICY visitor_invitations_tenant_all ON visitor_invitations FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());

COMMENT ON TABLE visitor_invitations IS
  'Plan v4. Admin-generated registration links for visitors. Slug is unguessable; '
  'public flow at /api/v1/public/visitor-invitations resolves via service-role.';

-- ---------------------------------------------------------------------
-- Seed privacy contact email + policy version on existing tenants.
-- Idempotent via COALESCE; only fills NULL columns.
-- Closes plan v3 leftover.
-- ---------------------------------------------------------------------
UPDATE tenants
   SET privacy_contact_email = COALESCE(privacy_contact_email, 'privacidad@propos.cl'),
       privacy_policy_version = COALESCE(privacy_policy_version, '1.0')
 WHERE slug IN ('ceter', 'anaida');
