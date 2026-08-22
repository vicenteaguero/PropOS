-- Prefer the property's address over the event's free text.
--
-- The previous migration coalesced the other way round, and the data showed why
-- that is wrong: `events.location` in practice holds a human label — "Casa
-- 3D/3B en venta en Macul", "Oficina de la corredora" — while the property row
-- holds "Gran Avenida 1575, Macul". A navigation app can do something with the
-- second and nothing with the first.
--
-- So: if the event is linked to a property, its address is where it happens.
-- The free text stays as the fallback, which is exactly the case it serves —
-- an event with no property at all.

CREATE OR REPLACE VIEW v_calendar_feed AS
SELECT
  e.tenant_id, 'EVENT' AS item_type, e.id, e.title, e.starts_at AS start_at,
  e.ends_at AS end_at, e.all_day, e.status::TEXT AS status, e.kind::TEXT AS kind,
  e.property_id, e.contact_id, NULL::BIGINT AS amount_cents,
  COALESCE(NULLIF(p.address, ''), NULLIF(e.location, '')) AS location
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

-- Restated with the definition, always. See 20240601000044.
ALTER VIEW public.v_calendar_feed SET (security_invoker = on);
