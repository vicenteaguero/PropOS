CREATE TABLE interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notes TEXT,
  user_id UUID REFERENCES profiles(id),
  contact_id UUID REFERENCES contacts(id),
  property_id UUID REFERENCES properties(id),
  tenant_id UUID REFERENCES tenants(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  tenant_id UUID REFERENCES tenants(id) NOT NULL,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
