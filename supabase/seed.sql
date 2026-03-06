-- PropOS Seed Data
-- NOTE: profiles reference auth.users. In local dev, create matching auth users
-- first (via Supabase dashboard or supabase auth signup), then run this seed.
-- The ON CONFLICT clauses make this script safe to run multiple times.

-- ============================================================
-- TENANTS
-- ============================================================
INSERT INTO tenants (id, name, slug) VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Anaida Desarrollos', 'anaida'),
  ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'Ceter Inmobiliaria', 'ceter')
ON CONFLICT DO NOTHING;

-- ============================================================
-- PROFILES (require matching auth.users entries)
-- ============================================================
INSERT INTO profiles (id, full_name, role, tenant_id) VALUES
  -- Anaida team
  ('11111111-1111-1111-1111-111111111111', 'Admin Usuario',       'ADMIN',     'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('22222222-2222-2222-2222-222222222222', 'Agente Lopez',        'AGENT',     'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('33333333-3333-3333-3333-333333333333', 'Carlos Terrateniente','LANDOWNER', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('44444444-4444-4444-4444-444444444444', 'Diana Compradora',    'BUYER',     'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('55555555-5555-5555-5555-555555555555', 'Editor Contenido',    'CONTENT',   'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('66666666-6666-6666-6666-666666666666', 'Sofia Agente',        'AGENT',     'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  -- Ceter team
  ('77777777-7777-7777-7777-777777777777', 'Ceter Admin',         'ADMIN',     'b2c3d4e5-f6a7-8901-bcde-f12345678901'),
  ('88888888-8888-8888-8888-888888888888', 'Ceter Agente',        'AGENT',     'b2c3d4e5-f6a7-8901-bcde-f12345678901')
ON CONFLICT DO NOTHING;

-- ============================================================
-- PROPERTIES
-- ============================================================
INSERT INTO properties (id, title, description, status, address, surface_m2, tenant_id, landowner_id) VALUES
  -- Anaida properties
  ('aaaa1111-1111-1111-1111-111111111111', 'Terreno Norte 5ha',
   'Terreno agricola zona norte con acceso a carretera principal. Ideal para desarrollo residencial de densidad media.',
   'AVAILABLE', 'Carretera Norte km 15, Col. San Miguel', 50000,
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '33333333-3333-3333-3333-333333333333'),

  ('aaaa2222-2222-2222-2222-222222222222', 'Lote Centro 2ha',
   'Lote urbano en zona centro con todos los servicios. Uso de suelo mixto aprobado.',
   'RESERVED', 'Av. Principal 200, Centro', 20000,
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '33333333-3333-3333-3333-333333333333'),

  ('aaaa3333-3333-3333-3333-333333333333', 'Parcela Sur 10ha',
   'Parcela para desarrollo habitacional con vista a la sierra. Proyecto de fraccionamiento en etapa de planeacion.',
   'AVAILABLE', 'Camino Sur s/n, Ejido Las Palmas', 100000,
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890', NULL),

  ('aaaa4444-4444-4444-4444-444444444444', 'Terreno Industrial Poniente',
   'Terreno en zona industrial con acceso a vias ferreas y carretera federal. Servicios de agua y luz en perimetro.',
   'AVAILABLE', 'Blvd. Industrial 500, Parque Poniente', 35000,
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890', NULL),

  ('aaaa5555-5555-5555-5555-555555555555', 'Rancho El Mezquite 20ha',
   'Rancho ganadero con pozo de agua, cercado perimetral, bodega de 200m2 y casa habitacion.',
   'SOLD', 'Carretera a Durango km 45', 200000,
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '33333333-3333-3333-3333-333333333333'),

  ('aaaa6666-6666-6666-6666-666666666666', 'Lote Residencial Las Lomas',
   'Lote premium en fraccionamiento cerrado con vigilancia 24/7. Amenidades incluyen area verde y casa club.',
   'RESERVED', 'Calle Encinos 15, Fracc. Las Lomas', 800,
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890', NULL),

  ('aaaa7777-7777-7777-7777-777777777777', 'Bodega Comercial Centro',
   'Bodega comercial en excelente ubicacion. Piso de concreto, altura 6m, acceso para trailer.',
   'INACTIVE', 'Calle Comercio 88, Zona Centro', 1500,
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890', NULL),

  ('aaaa8888-8888-8888-8888-888888888888', 'Terreno Oriente 3ha',
   'Terreno plano con frente a avenida principal. Ideal para plaza comercial o desarrollo vertical.',
   'AVAILABLE', 'Av. Oriente 1200, Col. Progreso', 30000,
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '33333333-3333-3333-3333-333333333333'),

  -- Ceter properties
  ('bbbb1111-1111-1111-1111-111111111111', 'Terreno Ceter Norte',
   'Terreno en zona de expansion urbana. Cuenta con factibilidad de servicios municipales.',
   'AVAILABLE', 'Prolongacion Norte 300', 15000,
   'b2c3d4e5-f6a7-8901-bcde-f12345678901', NULL),

  ('bbbb2222-2222-2222-2222-222222222222', 'Lote Ceter Playa',
   'Lote frente al mar en zona turistica. Ideal para desarrollo hotelero o residencial vacacional.',
   'RESERVED', 'Blvd. Costero km 8', 5000,
   'b2c3d4e5-f6a7-8901-bcde-f12345678901', NULL)
ON CONFLICT DO NOTHING;

-- ============================================================
-- CONTACTS
-- ============================================================
INSERT INTO contacts (id, full_name, email, phone, type, tenant_id, metadata) VALUES
  -- Anaida contacts
  ('cccc1111-1111-1111-1111-111111111111', 'Roberto Mendoza',
   'roberto.mendoza@example.com', '+52 555 111 2233', 'LANDOWNER',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   '{"company": "Terrenos del Norte SA", "rfc": "TNO201005ABC"}'),

  ('cccc2222-2222-2222-2222-222222222222', 'Maria Garcia',
   'maria.garcia@example.com', '+52 555 444 5566', 'BUYER',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   '{"budget": 5000000, "looking_for": "residencial"}'),

  ('cccc3333-3333-3333-3333-333333333333', 'Fernando Rios',
   'fernando.rios@example.com', '+52 555 777 8899', 'LANDOWNER',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   '{"company": "Grupo Rios", "properties_count": 3}'),

  ('cccc4444-4444-4444-4444-444444444444', 'Ana Lucia Torres',
   'ana.torres@example.com', '+52 555 222 3344', 'BUYER',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   '{"budget": 12000000, "looking_for": "industrial"}'),

  ('cccc5555-5555-5555-5555-555555555555', 'Pedro Salinas',
   NULL, '+52 555 666 9900', 'LANDOWNER',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   '{"notes": "Prefiere contacto por telefono"}'),

  ('cccc6666-6666-6666-6666-666666666666', 'Laura Vega',
   'laura.vega@inversiones.mx', '+52 555 333 4455', 'BUYER',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   '{"company": "Inversiones Vega", "budget": 25000000}'),

  ('cccc7777-7777-7777-7777-777777777777', 'Miguel Angel Duarte',
   'maduarte@example.com', NULL, 'BUYER',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   '{"looking_for": "terreno habitacional"}'),

  -- Ceter contacts
  ('cccc8888-8888-8888-8888-888888888888', 'Isabel Navarro',
   'isabel@cetercontacts.com', '+52 333 111 2233', 'LANDOWNER',
   'b2c3d4e5-f6a7-8901-bcde-f12345678901', NULL),

  ('cccc9999-9999-9999-9999-999999999999', 'Jorge Ramirez',
   'jorge.ramirez@example.com', '+52 333 444 5566', 'BUYER',
   'b2c3d4e5-f6a7-8901-bcde-f12345678901', NULL)
ON CONFLICT DO NOTHING;

-- ============================================================
-- PROJECTS
-- ============================================================
INSERT INTO projects (id, title, slug, status, property_id, tenant_id, microsite_config) VALUES
  -- Anaida projects
  ('dddd1111-1111-1111-1111-111111111111', 'Residencial Norte',
   'residencial-norte', 'PLANNING',
   'aaaa1111-1111-1111-1111-111111111111', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   '{"hero_title": "Residencial Norte", "hero_subtitle": "Tu nuevo hogar en la mejor zona", "primary_color": "#D4919B"}'),

  ('dddd2222-2222-2222-2222-222222222222', 'Plaza Centro Urbano',
   'plaza-centro-urbano', 'ACTIVE',
   'aaaa2222-2222-2222-2222-222222222222', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   '{"hero_title": "Plaza Centro Urbano", "hero_subtitle": "Comercio en el corazon de la ciudad"}'),

  ('dddd3333-3333-3333-3333-333333333333', 'Fraccionamiento Sur',
   'fraccionamiento-sur', 'PLANNING',
   'aaaa3333-3333-3333-3333-333333333333', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   '{"hero_title": "Fraccionamiento Las Palmas"}'),

  ('dddd4444-4444-4444-4444-444444444444', 'Nave Industrial Poniente',
   'nave-industrial-poniente', 'PAUSED',
   'aaaa4444-4444-4444-4444-444444444444', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   NULL),

  ('dddd5555-5555-5555-5555-555555555555', 'Rancho Ecoturistico',
   'rancho-ecoturistico', 'COMPLETED',
   'aaaa5555-5555-5555-5555-555555555555', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   '{"hero_title": "Rancho Ecoturistico El Mezquite", "status": "sold_out"}'),

  -- Ceter projects
  ('dddd6666-6666-6666-6666-666666666666', 'Desarrollo Costero',
   'desarrollo-costero', 'ACTIVE',
   'bbbb2222-2222-2222-2222-222222222222', 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
   '{"hero_title": "Vive Frente al Mar"}')
ON CONFLICT DO NOTHING;

-- ============================================================
-- INTERACTIONS
-- ============================================================
INSERT INTO interactions (id, notes, user_id, contact_id, property_id, tenant_id, created_at) VALUES
  ('eeee1111-1111-1111-1111-111111111111',
   'Llamada inicial con Roberto. Interesado en vender terreno norte. Se acordo visita para la proxima semana.',
   '22222222-2222-2222-2222-222222222222', 'cccc1111-1111-1111-1111-111111111111',
   'aaaa1111-1111-1111-1111-111111111111', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   NOW() - INTERVAL '30 days'),

  ('eeee2222-2222-2222-2222-222222222222',
   'Visita al terreno norte con Roberto. El terreno esta en buenas condiciones. Se solicito documentacion legal.',
   '22222222-2222-2222-2222-222222222222', 'cccc1111-1111-1111-1111-111111111111',
   'aaaa1111-1111-1111-1111-111111111111', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   NOW() - INTERVAL '23 days'),

  ('eeee3333-3333-3333-3333-333333333333',
   'Maria Garcia solicito informacion sobre lotes residenciales. Presupuesto de 5 millones. Se enviaron 3 opciones.',
   '22222222-2222-2222-2222-222222222222', 'cccc2222-2222-2222-2222-222222222222',
   NULL, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   NOW() - INTERVAL '15 days'),

  ('eeee4444-4444-4444-4444-444444444444',
   'Reunion con Ana Torres para presentar terreno industrial. Muy interesada, solicita avaluo formal.',
   '66666666-6666-6666-6666-666666666666', 'cccc4444-4444-4444-4444-444444444444',
   'aaaa4444-4444-4444-4444-444444444444', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   NOW() - INTERVAL '10 days'),

  ('eeee5555-5555-5555-5555-555555555555',
   'Seguimiento con Laura Vega. Confirma interes en terreno oriente para plaza comercial. Agenda visita.',
   '22222222-2222-2222-2222-222222222222', 'cccc6666-6666-6666-6666-666666666666',
   'aaaa8888-8888-8888-8888-888888888888', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   NOW() - INTERVAL '5 days'),

  ('eeee6666-6666-6666-6666-666666666666',
   'Fernando Rios entrego escrituras del terreno. Documentacion completa, se procede con valuacion.',
   '22222222-2222-2222-2222-222222222222', 'cccc3333-3333-3333-3333-333333333333',
   NULL, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   NOW() - INTERVAL '2 days')
ON CONFLICT DO NOTHING;

-- ============================================================
-- DOCUMENTS
-- ============================================================
INSERT INTO documents (id, filename, storage_path, entity_type, entity_id, tenant_id, uploaded_by, created_at) VALUES
  ('ffff1111-1111-1111-1111-111111111111',
   'escritura_terreno_norte.pdf', 'documents/anaida/aaaa1111/escritura_terreno_norte.pdf',
   'property', 'aaaa1111-1111-1111-1111-111111111111',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '22222222-2222-2222-2222-222222222222',
   NOW() - INTERVAL '20 days'),

  ('ffff2222-2222-2222-2222-222222222222',
   'avaluo_lote_centro.pdf', 'documents/anaida/aaaa2222/avaluo_lote_centro.pdf',
   'property', 'aaaa2222-2222-2222-2222-222222222222',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '11111111-1111-1111-1111-111111111111',
   NOW() - INTERVAL '18 days'),

  ('ffff3333-3333-3333-3333-333333333333',
   'plano_topografico_sur.pdf', 'documents/anaida/aaaa3333/plano_topografico_sur.pdf',
   'property', 'aaaa3333-3333-3333-3333-333333333333',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '22222222-2222-2222-2222-222222222222',
   NOW() - INTERVAL '12 days'),

  ('ffff4444-4444-4444-4444-444444444444',
   'contrato_compraventa_mezquite.pdf', 'documents/anaida/aaaa5555/contrato_compraventa.pdf',
   'property', 'aaaa5555-5555-5555-5555-555555555555',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '11111111-1111-1111-1111-111111111111',
   NOW() - INTERVAL '8 days'),

  ('ffff5555-5555-5555-5555-555555555555',
   'identificacion_roberto.jpg', 'documents/anaida/contacts/cccc1111/ine_roberto.jpg',
   'contact', 'cccc1111-1111-1111-1111-111111111111',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '22222222-2222-2222-2222-222222222222',
   NOW() - INTERVAL '25 days'),

  ('ffff6666-6666-6666-6666-666666666666',
   'master_plan_residencial_norte.pdf', 'documents/anaida/projects/dddd1111/master_plan.pdf',
   'project', 'dddd1111-1111-1111-1111-111111111111',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '55555555-5555-5555-5555-555555555555',
   NOW() - INTERVAL '6 days'),

  ('ffff7777-7777-7777-7777-777777777777',
   'render_fachada_plaza.jpg', 'documents/anaida/projects/dddd2222/render_fachada.jpg',
   'project', 'dddd2222-2222-2222-2222-222222222222',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '55555555-5555-5555-5555-555555555555',
   NOW() - INTERVAL '3 days'),

  ('ffff8888-8888-8888-8888-888888888888',
   'uso_de_suelo_industrial.pdf', 'documents/anaida/aaaa4444/uso_de_suelo.pdf',
   'property', 'aaaa4444-4444-4444-4444-444444444444',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '11111111-1111-1111-1111-111111111111',
   NOW() - INTERVAL '1 day')
ON CONFLICT DO NOTHING;

-- ============================================================
-- CHAT: CONVERSATIONS
-- ============================================================
INSERT INTO conversations (id, title, tenant_id, created_at) VALUES
  ('aabb1111-1111-1111-1111-111111111111', 'Terreno Norte - Negociacion',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890', NOW() - INTERVAL '14 days'),

  ('aabb2222-2222-2222-2222-222222222222', 'Equipo Anaida - General',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890', NOW() - INTERVAL '10 days'),

  ('aabb3333-3333-3333-3333-333333333333', 'Proyecto Plaza Centro',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890', NOW() - INTERVAL '7 days')
ON CONFLICT DO NOTHING;

-- ============================================================
-- CHAT: PARTICIPANTS
-- ============================================================
INSERT INTO conversation_participants (id, conversation_id, user_id, tenant_id) VALUES
  -- Terreno Norte chat: Admin + Agente
  ('aabb0001-0001-0001-0001-000000000001', 'aabb1111-1111-1111-1111-111111111111',
   '11111111-1111-1111-1111-111111111111', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('aabb0001-0001-0001-0001-000000000002', 'aabb1111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),

  -- General chat: Admin + Agente + Sofia + Editor
  ('aabb0002-0002-0002-0002-000000000001', 'aabb2222-2222-2222-2222-222222222222',
   '11111111-1111-1111-1111-111111111111', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('aabb0002-0002-0002-0002-000000000002', 'aabb2222-2222-2222-2222-222222222222',
   '22222222-2222-2222-2222-222222222222', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('aabb0002-0002-0002-0002-000000000003', 'aabb2222-2222-2222-2222-222222222222',
   '66666666-6666-6666-6666-666666666666', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('aabb0002-0002-0002-0002-000000000004', 'aabb2222-2222-2222-2222-222222222222',
   '55555555-5555-5555-5555-555555555555', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),

  -- Plaza Centro chat: Admin + Editor
  ('aabb0003-0003-0003-0003-000000000001', 'aabb3333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('aabb0003-0003-0003-0003-000000000002', 'aabb3333-3333-3333-3333-333333333333',
   '55555555-5555-5555-5555-555555555555', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890')
ON CONFLICT DO NOTHING;

-- ============================================================
-- CHAT: MESSAGES
-- ============================================================
INSERT INTO messages (id, conversation_id, sender_id, content, tenant_id, created_at) VALUES
  -- Terreno Norte conversation
  ('aa010001-0001-0001-0001-000000000001', 'aabb1111-1111-1111-1111-111111111111',
   '11111111-1111-1111-1111-111111111111',
   'Oye, como va la negociacion con Roberto por el terreno norte?',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890', NOW() - INTERVAL '14 days'),

  ('aa010001-0001-0001-0001-000000000002', 'aabb1111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222',
   'Bien, ya visite el terreno. Esta en buenas condiciones. Le pedi la documentacion.',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890', NOW() - INTERVAL '14 days' + INTERVAL '30 minutes'),

  ('aa010001-0001-0001-0001-000000000003', 'aabb1111-1111-1111-1111-111111111111',
   '11111111-1111-1111-1111-111111111111',
   'Perfecto. Necesitamos las escrituras y el certificado de libertad de gravamen.',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890', NOW() - INTERVAL '14 days' + INTERVAL '45 minutes'),

  ('aa010001-0001-0001-0001-000000000004', 'aabb1111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222',
   'Ya se lo solicite. Dice que lo tiene todo, lo entrega la proxima semana.',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890', NOW() - INTERVAL '13 days'),

  ('aa010001-0001-0001-0001-000000000005', 'aabb1111-1111-1111-1111-111111111111',
   '11111111-1111-1111-1111-111111111111',
   'Excelente. Cuando tenga la documentacion agendamos reunion para revisar numeros.',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890', NOW() - INTERVAL '13 days' + INTERVAL '2 hours'),

  -- General team conversation
  ('aa020002-0002-0002-0002-000000000001', 'aabb2222-2222-2222-2222-222222222222',
   '11111111-1111-1111-1111-111111111111',
   'Buenos dias equipo. Recordatorio: junta semanal manana a las 10am.',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890', NOW() - INTERVAL '10 days'),

  ('aa020002-0002-0002-0002-000000000002', 'aabb2222-2222-2222-2222-222222222222',
   '22222222-2222-2222-2222-222222222222',
   'Listo, ahi estare. Tengo actualizacion del terreno norte.',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890', NOW() - INTERVAL '10 days' + INTERVAL '1 hour'),

  ('aa020002-0002-0002-0002-000000000003', 'aabb2222-2222-2222-2222-222222222222',
   '66666666-6666-6666-6666-666666666666',
   'Yo tambien. Ana Torres quiere avanzar rapido con el terreno industrial.',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890', NOW() - INTERVAL '10 days' + INTERVAL '2 hours'),

  ('aa020002-0002-0002-0002-000000000004', 'aabb2222-2222-2222-2222-222222222222',
   '55555555-5555-5555-5555-555555555555',
   'Aprovecho para comentar que ya tengo los renders de la plaza centro listos para revision.',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890', NOW() - INTERVAL '9 days'),

  ('aa020002-0002-0002-0002-000000000005', 'aabb2222-2222-2222-2222-222222222222',
   '11111111-1111-1111-1111-111111111111',
   'Genial! Vamos bien. Nos vemos manana entonces.',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890', NOW() - INTERVAL '9 days' + INTERVAL '30 minutes'),

  -- Plaza Centro conversation
  ('aa030003-0003-0003-0003-000000000001', 'aabb3333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111',
   'Editor, como van los materiales para el microsite de Plaza Centro?',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890', NOW() - INTERVAL '7 days'),

  ('aa030003-0003-0003-0003-000000000002', 'aabb3333-3333-3333-3333-333333333333',
   '55555555-5555-5555-5555-555555555555',
   'Ya subi el render de la fachada. Falta el video aereo, lo tengo para el viernes.',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890', NOW() - INTERVAL '7 days' + INTERVAL '3 hours'),

  ('aa030003-0003-0003-0003-000000000003', 'aabb3333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111',
   'Perfecto. El cliente quiere ver el microsite la proxima semana.',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890', NOW() - INTERVAL '6 days'),

  ('aa030003-0003-0003-0003-000000000004', 'aabb3333-3333-3333-3333-333333333333',
   '55555555-5555-5555-5555-555555555555',
   'Entendido, lo tendremos listo. Tambien estoy preparando el master plan del Residencial Norte.',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890', NOW() - INTERVAL '5 days')
ON CONFLICT DO NOTHING;
