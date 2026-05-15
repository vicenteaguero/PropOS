-- Tech-debt reduction: profiles.is_dev_admin + profiles.view were added as
-- a snapshot of the active membership. Move both fully to tenant_memberships
-- and drop the snapshot columns so there is one source of truth.
--
-- profiles.role/tenant_id/admin_scope remain as denorm for legacy RLS (30+
-- policies in pre-multitenancy migrations).

-- 1) Rewrite audience_can() to read view from the active tenant membership.
CREATE OR REPLACE FUNCTION public.audience_can(p_caps JSONB, p_cap TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  my_view TEXT;
  active_tenant UUID;
BEGIN
  IF p_caps IS NULL OR p_caps = '{}'::jsonb THEN
    RETURN FALSE;
  END IF;

  active_tenant := get_my_tenant_id();
  IF active_tenant IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT view::TEXT INTO my_view
    FROM tenant_memberships
   WHERE user_id = auth.uid()
     AND tenant_id = active_tenant
     AND is_active;

  IF my_view IS NULL OR NOT (p_caps ? my_view) THEN
    RETURN FALSE;
  END IF;
  RETURN p_cap = ANY(SELECT jsonb_array_elements_text(p_caps -> my_view));
END; $$;

-- 2) Rewrite activate_tenant() to stop maintaining the soon-to-be-dropped
-- snapshot columns. Profile snapshot still keeps tenant_id/role/admin_scope
-- for legacy RLS compatibility.
CREATE OR REPLACE FUNCTION public.activate_tenant(p_tenant UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE m tenant_memberships%ROWTYPE;
BEGIN
  SELECT * INTO m
    FROM tenant_memberships
   WHERE user_id = auth.uid()
     AND tenant_id = p_tenant
     AND is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active membership in tenant %', p_tenant;
  END IF;

  PERFORM set_config('app.current_tenant_id', p_tenant::TEXT, true);

  UPDATE profiles
     SET tenant_id   = m.tenant_id,
         role        = m.role,
         admin_scope = m.admin_scope,
         updated_at  = now()
   WHERE id = auth.uid();
END; $$;

-- 3) Drop snapshot columns from profiles.
ALTER TABLE profiles
  DROP COLUMN IF EXISTS is_dev_admin,
  DROP COLUMN IF EXISTS view;

COMMENT ON FUNCTION public.audience_can(JSONB, TEXT) IS
  'Reads view from active tenant_membership (no longer from profiles snapshot).';
COMMENT ON FUNCTION public.activate_tenant(UUID) IS
  'Sets session app.current_tenant_id + syncs role/scope snapshot in profiles for legacy RLS.';
