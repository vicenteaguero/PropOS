-- =====================================================================
-- Event types as a per-tenant catalog, and a priority on the event itself.
--
-- `events.kind` was a Postgres enum with five hard-coded members, so a broker
-- whose week is built around tasaciones or entregas de llaves had to file them
-- under "Otro" — and "Otro" is where a filter stops being useful. Adding a
-- member meant a migration, a deploy, and a code change, which is not a thing
-- a tenant can ask for.
--
-- Two decisions worth stating:
--
-- 1. `kind` becomes TEXT, not an FK to `event_types.id`. The value is a stable
--    key ("VISIT"), the enum labels already in the column are valid keys, and
--    every existing row, view and Python literal keeps working untouched. An
--    FK would have required backfilling 4 000 rows against a table that does
--    not exist yet and rewriting `v_calendar_feed`'s three arms.
--
-- 2. `behavior` is what the UI reads, never `key`. A tenant's new "Tasación"
--    type declares `behavior = 'visit'` and immediately gets the visit field
--    layout (property, address, directions). Without it, every new type would
--    fall back to the blandest possible form.
-- =====================================================================

-- ---------------------------------------------------------------------
-- events.kind: enum -> TEXT
-- ---------------------------------------------------------------------
-- Postgres refuses to alter a column two views read, so both are dropped and
-- restated below, byte-identical to their current definitions apart from the
-- cast that is now a no-op. Nothing else reads them (checked against
-- pg_depend), so the window where they do not exist is this transaction.
DROP VIEW IF EXISTS public.v_calendar_feed;
DROP VIEW IF EXISTS public.v_entity_timeline;
-- The `propos_test` mirror has copies of both, and — a real bug, found here —
-- they read `public.events` rather than their own, so the test schema was never
-- isolated for these two views. Dropped, not restated: `propos_test` is
-- regenerated from the live structure with `make test-schema-rebuild`, which is
-- where the corrected definitions come from.
DROP VIEW IF EXISTS propos_test.v_calendar_feed;
DROP VIEW IF EXISTS propos_test.v_entity_timeline;

ALTER TABLE events ALTER COLUMN kind DROP DEFAULT;
ALTER TABLE events ALTER COLUMN kind TYPE TEXT USING kind::TEXT;
ALTER TABLE events ALTER COLUMN kind SET DEFAULT 'OTHER';

-- The enum survives only as `event_kind` with no columns using it; dropping it
-- would break `propos_test`, which is regenerated from this structure.
-- Constrain the shape instead: uppercase, no spaces, so a key stays a key.
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_kind_shape;
ALTER TABLE events ADD CONSTRAINT events_kind_shape
  CHECK (kind ~ '^[A-Z][A-Z0-9_]{0,31}$');

-- ---------------------------------------------------------------------
-- events.priority
-- ---------------------------------------------------------------------
-- 0 normal · 1 alta · 2 crítica. Same direction as `notes.priority`, so a
-- higher number is louder everywhere in the product.
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS priority SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_priority_range;
ALTER TABLE events ADD CONSTRAINT events_priority_range
  CHECK (priority BETWEEN 0 AND 2);

-- Two events in the same hour sort by priority before they sort by time, so
-- the index carries both.
CREATE INDEX IF NOT EXISTS idx_events_tenant_start_priority
  ON events(tenant_id, starts_at, priority DESC)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------
-- event_types
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- The value written into events.kind. Immutable in practice: renaming a key
  -- would orphan every event already filed under it, so the UI edits `label`.
  key TEXT NOT NULL CHECK (key ~ '^[A-Z][A-Z0-9_]{0,31}$'),
  label TEXT NOT NULL,
  -- A key from the fixed categorical palette (`shared/ui/event-palette.ts`),
  -- never a raw hex and never the tenant accent: the accent is derived from
  -- the workspace hue and can land on the same tone as `--success`, which is
  -- exactly how "Evento" and "Pago" ended up the same colour.
  color TEXT NOT NULL DEFAULT 'slate',
  icon TEXT,
  -- visit | meeting | call | deadline | other — drives which fields the event
  -- form shows. See the header.
  behavior TEXT NOT NULL DEFAULT 'other'
    CHECK (behavior IN ('visit', 'meeting', 'call', 'deadline', 'other')),
  position SMALLINT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  -- The five seeded types cannot be deleted: `events.kind` has no FK, so
  -- deleting VISIT would leave every visit rendering as an unknown key.
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, key)
);

CREATE INDEX IF NOT EXISTS idx_event_types_tenant
  ON event_types(tenant_id, position, label);

ALTER TABLE event_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS event_types_tenant_select ON event_types;
CREATE POLICY event_types_tenant_select ON event_types FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());
DROP POLICY IF EXISTS event_types_tenant_insert ON event_types;
CREATE POLICY event_types_tenant_insert ON event_types FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id());
DROP POLICY IF EXISTS event_types_tenant_update ON event_types;
CREATE POLICY event_types_tenant_update ON event_types FOR UPDATE TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());
DROP POLICY IF EXISTS event_types_tenant_delete ON event_types;
CREATE POLICY event_types_tenant_delete ON event_types FOR DELETE TO authenticated
  USING (tenant_id = public.get_my_tenant_id() AND is_system = FALSE);

-- ---------------------------------------------------------------------
-- Seed every existing tenant with the five types that used to be the enum
-- ---------------------------------------------------------------------
INSERT INTO event_types (tenant_id, key, label, color, icon, behavior, position, is_system)
SELECT t.id, v.key, v.label, v.color, v.icon, v.behavior, v.position, TRUE
FROM tenants t
CROSS JOIN (VALUES
  ('VISIT',    'Visita',        'violet', 'DoorOpen',      'visit',    0),
  ('MEETING',  'Reunión',       'sky',    'Users',         'meeting',  1),
  ('CALL',     'Llamada',       'teal',   'Phone',         'call',     2),
  ('DEADLINE', 'Vencimiento',   'amber',  'AlarmClock',    'deadline', 3),
  ('OTHER',    'Otro',          'slate',  'CalendarDays',  'other',    4)
) AS v(key, label, color, icon, behavior, position)
ON CONFLICT (tenant_id, key) DO NOTHING;

-- New tenants get them too. A tenant with an empty catalog would render a
-- calendar with no types at all, and the form's Tipo select would be blank.
CREATE OR REPLACE FUNCTION public.seed_event_types_for_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO event_types (tenant_id, key, label, color, icon, behavior, position, is_system)
  VALUES
    (NEW.id, 'VISIT',    'Visita',      'violet', 'DoorOpen',     'visit',    0, TRUE),
    (NEW.id, 'MEETING',  'Reunión',     'sky',    'Users',        'meeting',  1, TRUE),
    (NEW.id, 'CALL',     'Llamada',     'teal',   'Phone',        'call',     2, TRUE),
    (NEW.id, 'DEADLINE', 'Vencimiento', 'amber',  'AlarmClock',   'deadline', 3, TRUE),
    (NEW.id, 'OTHER',    'Otro',        'slate',  'CalendarDays', 'other',    4, TRUE)
  ON CONFLICT (tenant_id, key) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_event_types ON tenants;
CREATE TRIGGER trg_seed_event_types
  AFTER INSERT ON tenants
  FOR EACH ROW EXECUTE FUNCTION public.seed_event_types_for_tenant();

-- `updated_at`, the same trigger every other catalog uses.
DROP TRIGGER IF EXISTS trg_event_types_updated_at ON event_types;
CREATE TRIGGER trg_event_types_updated_at
  BEFORE UPDATE ON event_types
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Audited like every other catalog: a type that changes colour or disappears
-- changes what every calendar in the tenant looks like.
SELECT public.attach_audit('event_types');


-- ---------------------------------------------------------------------
-- The two views, restated unchanged (see the DROP above)
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_calendar_feed AS
SELECT
  e.tenant_id, 'EVENT' AS item_type, e.id, e.title, e.starts_at AS start_at,
  e.ends_at AS end_at, e.all_day, e.status::TEXT AS status, e.kind::TEXT AS kind,
  e.property_id, e.contact_id, NULL::BIGINT AS amount_cents,
  COALESCE(NULLIF(p.address, ''), NULLIF(e.location, '')) AS location,
  e.opportunity_id
FROM events e
LEFT JOIN properties p ON p.id = e.property_id AND p.tenant_id = e.tenant_id
WHERE e.deleted_at IS NULL
UNION ALL
SELECT
  t.tenant_id, 'TASK' AS item_type, t.id, t.title, t.due_at AS start_at,
  NULL::TIMESTAMPTZ AS end_at, FALSE AS all_day, t.status::TEXT AS status,
  t.kind::TEXT AS kind, NULL::UUID AS property_id, NULL::UUID AS contact_id,
  NULL::BIGINT AS amount_cents, NULL::TEXT AS location, NULL::UUID AS opportunity_id
FROM tasks t
WHERE t.deleted_at IS NULL AND t.due_at IS NOT NULL AND t.status NOT IN ('DONE', 'CANCELLED')
UNION ALL
SELECT
  tr.tenant_id, 'PAYMENT' AS item_type, tr.id,
  COALESCE(tr.description, tr.category::TEXT) AS title, tr.due_at AS start_at,
  NULL::TIMESTAMPTZ AS end_at, FALSE AS all_day, tr.status::TEXT AS status,
  tr.category::TEXT AS kind, tr.related_property_id AS property_id,
  tr.payer_person_id AS contact_id, tr.amount_cents, NULL::TEXT AS location,
  -- `transactions` carries no deal link of its own.
  NULL::UUID AS opportunity_id
FROM transactions tr
WHERE tr.deleted_at IS NULL AND tr.status = 'PENDING' AND tr.due_at IS NOT NULL;

-- Restated with the definition, always. Without this the view runs as its
-- owner and every tenant sees every row. See 20240601000044.
ALTER VIEW public.v_calendar_feed SET (security_invoker = on);

CREATE OR REPLACE VIEW v_entity_timeline AS
-- 1. Audit: the only branch carrying source='agent', which is how a human
--    tells their own edits from Propo's.
SELECT
  a.tenant_id, a.table_name, a.row_id, a.changed_at AS event_at,
  'audit' AS event_type, a.op AS event_subtype, a.source AS source,
  a.changed_by AS actor,
  jsonb_build_object('before', a.before, 'after', a.after) AS payload
FROM audit_log a

UNION ALL
-- 2. Interactions, by what they were about. `target_kind` is mapped to the
--    real table name instead of being cast to TEXT.
SELECT
  i.tenant_id,
  CASE it.target_kind
    WHEN 'PROPERTY'    THEN 'properties'
    WHEN 'PROJECT'     THEN 'projects'
    WHEN 'OPPORTUNITY' THEN 'opportunities'
    WHEN 'PLACE'       THEN 'places'
  END AS table_name,
  COALESCE(it.property_id, it.project_id, it.opportunity_id, it.place_id) AS row_id,
  i.occurred_at AS event_at, 'interaction' AS event_type, i.kind::TEXT AS event_subtype,
  i.source, i.created_by AS actor,
  jsonb_build_object('summary', i.summary, 'body', i.body) AS payload
FROM interactions i
JOIN interaction_targets it ON it.interaction_id = i.id
WHERE i.deleted_at IS NULL

UNION ALL
-- 3. Interactions, by WHO was in them. The branch that never existed, and the
--    reason a person's own calls were missing from their own page.
SELECT
  i.tenant_id, 'contacts' AS table_name, ip.person_id AS row_id,
  i.occurred_at AS event_at, 'interaction' AS event_type, i.kind::TEXT AS event_subtype,
  i.source, i.created_by AS actor,
  jsonb_build_object('summary', i.summary, 'body', i.body, 'role', ip.role) AS payload
FROM interactions i
JOIN interaction_participants ip ON ip.interaction_id = i.id
WHERE i.deleted_at IS NULL

UNION ALL
-- 4. Notes, via the typed bridge. `notes.target_table` is the legacy pair and
--    stays readable, but `note_targets` is where multi-target notes live.
SELECT
  n.tenant_id,
  CASE nt.target_kind
    WHEN 'PROPERTY'    THEN 'properties'
    WHEN 'CONTACT'     THEN 'contacts'
    WHEN 'OPPORTUNITY' THEN 'opportunities'
    WHEN 'EVENT'       THEN 'events'
    WHEN 'PROJECT'     THEN 'projects'
    WHEN 'PLACE'       THEN 'places'
  END AS table_name,
  COALESCE(nt.property_id, nt.contact_id, nt.opportunity_id, nt.event_id,
           nt.project_id, nt.place_id) AS row_id,
  n.created_at AS event_at, 'note' AS event_type, NULL AS event_subtype,
  n.source, n.created_by AS actor,
  jsonb_build_object('body', n.body) AS payload
FROM notes n
JOIN note_targets nt ON nt.note_id = n.id
WHERE n.deleted_at IS NULL

UNION ALL
-- 5. Tasks. `related` is {"<table>": [ids]}; the writer, the reader and this
--    view disagreed on whether people live under 'people' or 'contacts', so
--    both are read until the data settles on one.
SELECT
  t.tenant_id, 'contacts' AS table_name, person_id::UUID AS row_id,
  t.created_at AS event_at, 'task' AS event_type, t.status::TEXT AS event_subtype,
  t.source, t.created_by AS actor,
  jsonb_build_object('title', t.title, 'due_at', t.due_at) AS payload
FROM tasks t,
     jsonb_array_elements_text(COALESCE(t.related -> 'contacts', t.related -> 'people', '[]'::jsonb)) person_id
WHERE t.deleted_at IS NULL

UNION ALL
SELECT
  t.tenant_id, 'properties' AS table_name, property_id::UUID AS row_id,
  t.created_at AS event_at, 'task' AS event_type, t.status::TEXT AS event_subtype,
  t.source, t.created_by AS actor,
  jsonb_build_object('title', t.title, 'due_at', t.due_at) AS payload
FROM tasks t,
     jsonb_array_elements_text(COALESCE(t.related -> 'properties', '[]'::jsonb)) property_id
WHERE t.deleted_at IS NULL

UNION ALL
-- 6. Calendar.
SELECT
  e.tenant_id, 'contacts' AS table_name, e.contact_id AS row_id,
  e.starts_at AS event_at, 'event' AS event_type, e.kind::TEXT AS event_subtype,
  e.source, e.created_by AS actor,
  jsonb_build_object('title', e.title, 'status', e.status) AS payload
FROM events e
WHERE e.deleted_at IS NULL AND e.contact_id IS NOT NULL

UNION ALL
SELECT
  e.tenant_id, 'properties' AS table_name, e.property_id AS row_id,
  e.starts_at AS event_at, 'event' AS event_type, e.kind::TEXT AS event_subtype,
  e.source, e.created_by AS actor,
  jsonb_build_object('title', e.title, 'status', e.status) AS payload
FROM events e
WHERE e.deleted_at IS NULL AND e.property_id IS NOT NULL

UNION ALL
-- 7. WhatsApp. The conversation IS the record; it had no branch at all.
SELECT
  m.tenant_id, 'contacts' AS table_name, c.contact_id AS row_id,
  m.created_at AS event_at, 'message' AS event_type, m.direction AS event_subtype,
  CASE m.sender_type WHEN 'agent_ai' THEN 'agent' ELSE 'user' END AS source,
  m.sender_user_id AS actor,
  jsonb_build_object('channel', 'whatsapp', 'content', m.content,
                     'conversation_id', m.conversation_id) AS payload
FROM client_messages m
JOIN client_conversations c ON c.id = m.conversation_id
WHERE c.contact_id IS NOT NULL

UNION ALL
-- 8. E-mail.
SELECT
  em.tenant_id, 'contacts' AS table_name, em.contact_id AS row_id,
  em.sent_at AS event_at, 'message' AS event_type, em.direction AS event_subtype,
  'user' AS source, NULL::UUID AS actor,
  jsonb_build_object('channel', 'email', 'subject', em.subject,
                     'snippet', em.snippet, 'thread_id', em.thread_id) AS payload
FROM email_messages em
WHERE em.contact_id IS NOT NULL

UNION ALL
-- 9. Stage changes, so a deal's page shows how it got where it is.
SELECT
  h.tenant_id, 'opportunities' AS table_name, h.opportunity_id AS row_id,
  h.changed_at AS event_at, 'stage' AS event_type, h.to_stage AS event_subtype,
  'user' AS source, h.changed_by AS actor,
  jsonb_build_object('from_stage', h.from_stage, 'to_stage', h.to_stage,
                     'note', h.note) AS payload
FROM opportunity_stage_history h;

-- Views default to the definer's rights; every other view in this schema was
-- switched to the caller's in 20240601000044 and this replacement must not
-- silently opt back out.
ALTER VIEW v_entity_timeline SET (security_invoker = true);
