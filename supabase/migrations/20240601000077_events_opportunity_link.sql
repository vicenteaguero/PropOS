-- =====================================================================
-- events: which deal this is part of
--
-- An event could say which property and which contact it concerned, but not
-- which negocio — so opening a visit gave you no way to reach the deal it
-- belongs to, which is where everything else about it lives (the other
-- participants, the stage, the checklist, the documents).
--
-- Nullable on purpose: plenty of events are not part of any deal.
-- =====================================================================

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_events_opportunity
  ON events(tenant_id, opportunity_id)
  WHERE opportunity_id IS NOT NULL AND deleted_at IS NULL;

-- Carry it through the calendar feed, so the event sheet can offer the deal
-- without a second round-trip per row.
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
