-- =====================================================================
-- Carry `events.priority` through the calendar feed.
--
-- 20240601000080 added the column and the event form writes it, but
-- `v_calendar_feed` does not select it — so a field that can be set and never
-- read is a field that does nothing. The calendar needs it to break ties
-- inside an hour and to mark the row.
--
-- The other two arms of the union have their own notion of urgency and are
-- mapped onto the same 0-2 scale rather than left null: a pending payment and
-- an overdue task are exactly the rows that should sort first in their block.
-- =====================================================================

CREATE OR REPLACE VIEW v_calendar_feed AS
SELECT
  e.tenant_id, 'EVENT' AS item_type, e.id, e.title, e.starts_at AS start_at,
  e.ends_at AS end_at, e.all_day, e.status::TEXT AS status, e.kind::TEXT AS kind,
  e.property_id, e.contact_id, NULL::BIGINT AS amount_cents,
  COALESCE(NULLIF(p.address, ''), NULLIF(e.location, '')) AS location,
  e.opportunity_id,
  e.priority
FROM events e
LEFT JOIN properties p ON p.id = e.property_id AND p.tenant_id = e.tenant_id
WHERE e.deleted_at IS NULL
UNION ALL
SELECT
  t.tenant_id, 'TASK' AS item_type, t.id, t.title, t.due_at AS start_at,
  NULL::TIMESTAMPTZ AS end_at, FALSE AS all_day, t.status::TEXT AS status,
  t.kind::TEXT AS kind, NULL::UUID AS property_id, NULL::UUID AS contact_id,
  NULL::BIGINT AS amount_cents, NULL::TEXT AS location, NULL::UUID AS opportunity_id,
  -- `tasks.priority` is an unbounded SMALLINT (the seeder writes 3), so it is
  -- clamped onto the same 0-2 scale the events column enforces.
  LEAST(GREATEST(COALESCE(t.priority, 0), 0), 2)::SMALLINT AS priority
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
  NULL::UUID AS opportunity_id,
  -- Money that is already late is the loudest thing on any day.
  (CASE WHEN tr.due_at < now() THEN 2 ELSE 1 END)::SMALLINT AS priority
FROM transactions tr
WHERE tr.deleted_at IS NULL AND tr.status = 'PENDING' AND tr.due_at IS NOT NULL;

-- Restated with the definition, always. Without this the view runs as its
-- owner and every tenant sees every row. See 20240601000044.
ALTER VIEW public.v_calendar_feed SET (security_invoker = on);
