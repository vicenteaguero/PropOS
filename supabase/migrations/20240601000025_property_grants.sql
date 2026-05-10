-- =====================================================================
-- property_grants — explicit per-user × per-property capability grants
--
-- Used by non-admin views (owner/buyer/agent restricted) to gate access
-- to specific properties + their child resources (documents, visits).
-- Capability tokens are open-vocabulary TEXT[]; conventional set:
--   view_property, view_documents, download_documents,
--   view_visits, view_visitor_identity, view_visit_documents,
--   comment, upload_documents
-- =====================================================================

CREATE TABLE IF NOT EXISTS property_grants (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id  UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  tenant_id    UUID NOT NULL REFERENCES tenants(id)    ON DELETE CASCADE,
  view         user_view NOT NULL DEFAULT 'owner',
  capabilities TEXT[] NOT NULL DEFAULT '{}',
  granted_by   UUID REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, property_id)
);

CREATE INDEX IF NOT EXISTS property_grants_user_idx     ON property_grants(user_id);
CREATE INDEX IF NOT EXISTS property_grants_property_idx ON property_grants(property_id);
CREATE INDEX IF NOT EXISTS property_grants_tenant_idx   ON property_grants(tenant_id);

ALTER TABLE property_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY property_grants_self_select ON property_grants FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY property_grants_admin_all ON property_grants FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p
            WHERE p.id = auth.uid() AND p.role = 'ADMIN' AND p.tenant_id = property_grants.tenant_id)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p
            WHERE p.id = auth.uid() AND p.role = 'ADMIN' AND p.tenant_id = property_grants.tenant_id)
  );

CREATE OR REPLACE FUNCTION public.user_has_property_cap(p_property UUID, p_cap TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM property_grants
     WHERE user_id = auth.uid()
       AND property_id = p_property
       AND p_cap = ANY(capabilities)
  );
$$;

CREATE OR REPLACE FUNCTION public.audience_can(p_caps JSONB, p_cap TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  my_view TEXT;
BEGIN
  SELECT view::TEXT INTO my_view FROM profiles WHERE id = auth.uid();
  IF my_view IS NULL OR p_caps IS NULL THEN
    RETURN FALSE;
  END IF;
  IF NOT (p_caps ? my_view) THEN
    RETURN FALSE;
  END IF;
  RETURN p_cap = ANY(SELECT jsonb_array_elements_text(p_caps -> my_view));
END;
$$;

COMMENT ON TABLE property_grants IS
  'Per-user × per-property explicit access grants with capability tokens.';
COMMENT ON FUNCTION public.user_has_property_cap(UUID, TEXT) IS
  'True iff current user has the named capability on the property.';
COMMENT ON FUNCTION public.audience_can(JSONB, TEXT) IS
  'True iff current user view appears in audience_caps JSONB and has the cap listed.';
