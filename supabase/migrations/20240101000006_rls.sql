ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_tenant_isolation" ON profiles
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "properties_tenant_isolation" ON properties
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "landowner_own_properties" ON properties
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) != 'LANDOWNER'
    OR landowner_id = auth.uid()
  );

CREATE POLICY "contacts_tenant_isolation" ON contacts
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "projects_tenant_isolation" ON projects
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "interactions_tenant_isolation" ON interactions
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "documents_tenant_isolation" ON documents
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "tenants_read_own" ON tenants
  FOR SELECT USING (id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
