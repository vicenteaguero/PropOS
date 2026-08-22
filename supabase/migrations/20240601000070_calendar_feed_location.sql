-- The address a calendar item happens at.
--
-- `v_calendar_feed` carried `property_id` but no text, and the full row is only
-- available from `GET /v1/events/{id}` — so a home screen showing "Visita —
-- Casa 3D/3B, Macul" could not offer "cómo llegar" without one request per
-- item. Which is why the only Waze/Maps links in the product live on a property
-- detail page nobody opens on their way out the door.
--
-- `location` is the event's own free text; falling back to the property's
-- address covers the common case, where the broker linked the property and
-- never retyped where it is.

CREATE OR REPLACE VIEW v_calendar_feed AS
SELECT
  e.tenant_id, 'EVENT' AS item_type, e.id, e.title, e.starts_at AS start_at,
  e.ends_at AS end_at, e.all_day, e.status::TEXT AS status, e.kind::TEXT AS kind,
  e.property_id, e.contact_id, NULL::BIGINT AS amount_cents,
  COALESCE(NULLIF(e.location, ''), p.address) AS location
FROM events e
LEFT JOIN properties p ON p.id = e.property_id AND p.tenant_id = e.tenant_id
WHERE e.deleted_at IS NULL
UNION ALL
SELECT
  t.tenant_id, 'TASK' AS item_type, t.id, t.title, t.due_at AS start_at,
  NULL::TIMESTAMPTZ AS end_at, FALSE AS all_day, t.status::TEXT AS status,
  t.kind::TEXT AS kind, NULL::UUID AS property_id, NULL::UUID AS contact_id,
  NULL::BIGINT AS amount_cents, NULL::TEXT AS location
FROM tasks t
WHERE t.deleted_at IS NULL AND t.due_at IS NOT NULL AND t.status NOT IN ('DONE', 'CANCELLED')
UNION ALL
SELECT
  tr.tenant_id, 'PAYMENT' AS item_type, tr.id,
  COALESCE(tr.description, tr.category::TEXT) AS title, tr.due_at AS start_at,
  NULL::TIMESTAMPTZ AS end_at, FALSE AS all_day, tr.status::TEXT AS status,
  tr.category::TEXT AS kind, tr.related_property_id AS property_id,
  tr.payer_person_id AS contact_id, tr.amount_cents, NULL::TEXT AS location
FROM transactions tr
WHERE tr.deleted_at IS NULL AND tr.status = 'PENDING' AND tr.due_at IS NOT NULL;

-- Restated, not assumed. `CREATE OR REPLACE VIEW` rewrites the view's options,
-- and a view without `security_invoker` evaluates its underlying tables as the
-- OWNER — which bypasses RLS and turns a calendar into every tenant's calendar.
-- That was a real finding in the R3 audit (see 20240601000044); a migration that
-- replaces one of these views has to put it back in the same breath.
ALTER VIEW public.v_calendar_feed SET (security_invoker = on);
