-- =====================================================================
-- Tenant activation: rewrite get_my_tenant_id() + add activate_tenant()
--
-- get_my_tenant_id() now honors a session override (set via activate_tenant)
-- and falls back to profiles.tenant_id snapshot. activate_tenant validates
-- the user has a membership in the requested tenant, then updates the
-- profile snapshot fields so existing RLS (reading profiles.role/scope/etc)
-- targets the active membership.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_my_tenant_id()
RETURNS UUID
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  override_text TEXT;
  fallback UUID;
BEGIN
  override_text := current_setting('app.current_tenant_id', true);
  IF override_text IS NOT NULL AND override_text <> '' THEN
    RETURN override_text::UUID;
  END IF;
  SELECT tenant_id INTO fallback FROM profiles WHERE id = auth.uid();
  RETURN fallback;
END;
$$;

CREATE OR REPLACE FUNCTION public.activate_tenant(p_tenant UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m tenant_memberships%ROWTYPE;
BEGIN
  SELECT * INTO m FROM tenant_memberships
   WHERE user_id = auth.uid() AND tenant_id = p_tenant AND is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active membership in tenant %', p_tenant;
  END IF;
  PERFORM set_config('app.current_tenant_id', p_tenant::TEXT, true);
  UPDATE profiles
     SET tenant_id    = m.tenant_id,
         role         = m.role,
         admin_scope  = m.admin_scope,
         is_dev_admin = m.is_dev_admin,
         view         = m.view,
         updated_at   = now()
   WHERE id = auth.uid();
END;
$$;

COMMENT ON FUNCTION public.activate_tenant(UUID) IS
  'Validates membership and sets profile snapshot to that tenant. Backend calls per-request when X-Tenant-Id header changes.';
