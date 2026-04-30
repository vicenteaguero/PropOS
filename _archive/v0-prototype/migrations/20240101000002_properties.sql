CREATE TYPE property_status AS ENUM ('AVAILABLE', 'RESERVED', 'SOLD', 'INACTIVE');

CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status property_status DEFAULT 'AVAILABLE',
  address TEXT,
  surface_m2 NUMERIC,
  tenant_id UUID REFERENCES tenants(id) NOT NULL,
  landowner_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
