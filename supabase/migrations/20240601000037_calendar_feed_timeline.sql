-- =====================================================================
-- v_calendar_feed: unified agenda (events + tasks-with-due + payments).
-- The full column set is declared now so P6 can CREATE OR REPLACE to add
-- the PAYMENT branch without changing the view's output columns.
-- =====================================================================

CREATE OR REPLACE VIEW v_calendar_feed AS
SELECT
  e.tenant_id,
  'EVENT' AS item_type,
  e.id,
  e.title,
  e.starts_at AS start_at,
  e.ends_at AS end_at,
  e.all_day,
  e.status::TEXT AS status,
  e.kind::TEXT AS kind,
  e.property_id,
  e.contact_id,
  NULL::BIGINT AS amount_cents
FROM events e
WHERE e.deleted_at IS NULL
UNION ALL
SELECT
  t.tenant_id,
  'TASK' AS item_type,
  t.id,
  t.title,
  t.due_at AS start_at,
  NULL::TIMESTAMPTZ AS end_at,
  FALSE AS all_day,
  t.status::TEXT AS status,
  t.kind::TEXT AS kind,
  NULL::UUID AS property_id,
  NULL::UUID AS contact_id,
  NULL::BIGINT AS amount_cents
FROM tasks t
WHERE t.deleted_at IS NULL
  AND t.due_at IS NOT NULL
  AND t.status NOT IN ('DONE', 'CANCELLED');

-- ---------------------------------------------------------------------
-- v_entity_timeline: now also surfaces tasks + events (fixes the stale
-- header comment in 20240101000032 — the original SQL only had notes).
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_entity_timeline AS
SELECT
  a.tenant_id, a.table_name, a.row_id, a.changed_at AS event_at,
  'audit' AS event_type, a.op AS event_subtype, a.source AS source,
  a.changed_by AS actor,
  jsonb_build_object('before', a.before, 'after', a.after) AS payload
FROM audit_log a
UNION ALL
SELECT
  i.tenant_id, it.target_kind::TEXT AS table_name,
  COALESCE(it.property_id, it.project_id, it.opportunity_id, it.place_id) AS row_id,
  i.occurred_at AS event_at, 'interaction' AS event_type, i.kind::TEXT AS event_subtype,
  i.source, i.created_by AS actor,
  jsonb_build_object('summary', i.summary, 'body', i.body) AS payload
FROM interactions i
JOIN interaction_targets it ON it.interaction_id = i.id
WHERE i.deleted_at IS NULL
UNION ALL
SELECT
  n.tenant_id, n.target_table AS table_name, n.target_row_id AS row_id,
  n.created_at AS event_at, 'note' AS event_type, NULL AS event_subtype,
  n.source, n.created_by AS actor,
  jsonb_build_object('body', n.body) AS payload
FROM notes n
WHERE n.deleted_at IS NULL AND n.target_row_id IS NOT NULL
-- tasks linked to people
UNION ALL
SELECT
  t.tenant_id, 'contacts' AS table_name, (pe.value)::UUID AS row_id,
  t.created_at AS event_at, 'task' AS event_type, t.status::TEXT AS event_subtype,
  t.source, t.created_by AS actor,
  jsonb_build_object('title', t.title, 'due_at', t.due_at) AS payload
FROM tasks t, jsonb_array_elements_text(t.related -> 'people') AS pe
WHERE t.deleted_at IS NULL AND t.related ? 'people'
-- tasks linked to properties
UNION ALL
SELECT
  t.tenant_id, 'properties' AS table_name, (pr.value)::UUID AS row_id,
  t.created_at AS event_at, 'task' AS event_type, t.status::TEXT AS event_subtype,
  t.source, t.created_by AS actor,
  jsonb_build_object('title', t.title, 'due_at', t.due_at) AS payload
FROM tasks t, jsonb_array_elements_text(t.related -> 'properties') AS pr
WHERE t.deleted_at IS NULL AND t.related ? 'properties'
-- events linked to a contact
UNION ALL
SELECT
  e.tenant_id, 'contacts' AS table_name, e.contact_id AS row_id,
  e.starts_at AS event_at, 'event' AS event_type, e.kind::TEXT AS event_subtype,
  e.source, e.created_by AS actor,
  jsonb_build_object('title', e.title, 'location', e.location) AS payload
FROM events e
WHERE e.deleted_at IS NULL AND e.contact_id IS NOT NULL
-- events linked to a property
UNION ALL
SELECT
  e.tenant_id, 'properties' AS table_name, e.property_id AS row_id,
  e.starts_at AS event_at, 'event' AS event_type, e.kind::TEXT AS event_subtype,
  e.source, e.created_by AS actor,
  jsonb_build_object('title', e.title, 'location', e.location) AS payload
FROM events e
WHERE e.deleted_at IS NULL AND e.property_id IS NOT NULL;
