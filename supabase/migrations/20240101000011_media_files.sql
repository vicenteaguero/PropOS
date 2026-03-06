CREATE TABLE media_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  url TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('photo', 'audio')),
  source TEXT NOT NULL CHECK (source IN ('camera', 'gallery', 'recorder')),
  tenant_id UUID REFERENCES tenants(id),
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE media_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert media" ON media_files
  FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "Tenant can read media" ON media_files
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
