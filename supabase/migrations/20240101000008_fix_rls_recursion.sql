-- Create a SECURITY DEFINER function to get current user's tenant_id
-- This bypasses RLS, breaking the infinite recursion in profiles policies.
CREATE OR REPLACE FUNCTION public.get_my_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM profiles WHERE id = auth.uid();
$$;

-- Drop the recursive policy
DROP POLICY IF EXISTS "profiles_tenant_isolation" ON profiles;

-- Replace with a non-recursive version: users can see profiles in their tenant
CREATE POLICY "profiles_tenant_isolation" ON profiles
  FOR SELECT USING (
    id = auth.uid()
    OR tenant_id = public.get_my_tenant_id()
  );

DROP POLICY IF EXISTS "tenants_read_own" ON tenants;
CREATE POLICY "tenants_read_own" ON tenants
  FOR SELECT USING (id = public.get_my_tenant_id());
