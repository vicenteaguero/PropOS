-- PropOS seed
-- Two baseline tenants. Real features will add their own seed data.
INSERT INTO tenants (id, name, slug) VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Anaida Desarrollos', 'anaida'),
  ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'Ceter Inmobiliaria', 'ceter')
ON CONFLICT DO NOTHING;
