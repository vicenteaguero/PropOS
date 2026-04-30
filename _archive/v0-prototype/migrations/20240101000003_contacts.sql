CREATE TYPE contact_type AS ENUM ('LANDOWNER', 'BUYER');

CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  type contact_type NOT NULL,
  tenant_id UUID REFERENCES tenants(id) NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
