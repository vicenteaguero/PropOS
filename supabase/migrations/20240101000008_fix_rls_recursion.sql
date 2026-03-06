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

-- Update all other tenant isolation policies to use the function
DROP POLICY IF EXISTS "properties_tenant_isolation" ON properties;
CREATE POLICY "properties_tenant_isolation" ON properties
  USING (tenant_id = public.get_my_tenant_id());

DROP POLICY IF EXISTS "landowner_own_properties" ON properties;
CREATE POLICY "landowner_own_properties" ON properties
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) != 'LANDOWNER'
    OR landowner_id = auth.uid()
  );

DROP POLICY IF EXISTS "contacts_tenant_isolation" ON contacts;
CREATE POLICY "contacts_tenant_isolation" ON contacts
  USING (tenant_id = public.get_my_tenant_id());

DROP POLICY IF EXISTS "projects_tenant_isolation" ON projects;
CREATE POLICY "projects_tenant_isolation" ON projects
  USING (tenant_id = public.get_my_tenant_id());

DROP POLICY IF EXISTS "interactions_tenant_isolation" ON interactions;
CREATE POLICY "interactions_tenant_isolation" ON interactions
  USING (tenant_id = public.get_my_tenant_id());

DROP POLICY IF EXISTS "documents_tenant_isolation" ON documents;
CREATE POLICY "documents_tenant_isolation" ON documents
  USING (tenant_id = public.get_my_tenant_id());

DROP POLICY IF EXISTS "tenants_read_own" ON tenants;
CREATE POLICY "tenants_read_own" ON tenants
  FOR SELECT USING (id = public.get_my_tenant_id());
