ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_tenant_isolation" ON profiles
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "tenants_read_own" ON tenants
  FOR SELECT USING (id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
