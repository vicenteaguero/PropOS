INSERT INTO tenants (id, name, slug) VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Anaida Desarrollos', 'anaida'),
  ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'Ceter Inmobiliaria', 'ceter')
ON CONFLICT DO NOTHING;

INSERT INTO profiles (id, full_name, role, tenant_id) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Admin Usuario', 'ADMIN', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('22222222-2222-2222-2222-222222222222', 'Agente López', 'AGENT', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('33333333-3333-3333-3333-333333333333', 'Carlos Terrateniente', 'LANDOWNER', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('44444444-4444-4444-4444-444444444444', 'Diana Compradora', 'BUYER', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('55555555-5555-5555-5555-555555555555', 'Editor Contenido', 'CONTENT', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890')
ON CONFLICT DO NOTHING;

INSERT INTO properties (id, title, description, status, address, surface_m2, tenant_id, landowner_id) VALUES
  ('aaaa1111-1111-1111-1111-111111111111', 'Terreno Norte 5ha', 'Terreno agrícola zona norte', 'AVAILABLE', 'Carretera Norte km 15', 50000, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '33333333-3333-3333-3333-333333333333'),
  ('aaaa2222-2222-2222-2222-222222222222', 'Lote Centro 2ha', 'Lote urbano en zona centro', 'RESERVED', 'Av. Principal 200', 20000, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '33333333-3333-3333-3333-333333333333'),
  ('aaaa3333-3333-3333-3333-333333333333', 'Parcela Sur 10ha', 'Parcela para desarrollo habitacional', 'AVAILABLE', 'Camino Sur s/n', 100000, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', NULL)
ON CONFLICT DO NOTHING;

INSERT INTO contacts (id, full_name, email, phone, type, tenant_id) VALUES
  ('cccc1111-1111-1111-1111-111111111111', 'Roberto Vendedor', 'roberto@example.com', '+52 555 111 2233', 'LANDOWNER', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('cccc2222-2222-2222-2222-222222222222', 'María Interesada', 'maria@example.com', '+52 555 444 5566', 'BUYER', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890')
ON CONFLICT DO NOTHING;

INSERT INTO projects (id, title, slug, status, property_id, tenant_id) VALUES
  ('dddd1111-1111-1111-1111-111111111111', 'Residencial Norte', 'residencial-norte', 'PLANNING', 'aaaa1111-1111-1111-1111-111111111111', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890')
ON CONFLICT DO NOTHING;
