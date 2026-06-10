-- =====================================================================
-- Payment lifecycle on transactions: pending / completed / receivable.
-- "Por cobrar" = direction IN + status PENDING; "por pagar" = OUT + PENDING.
-- Existing rows are recorded facts → default COMPLETED.
-- =====================================================================

CREATE TYPE transaction_status AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

ALTER TABLE transactions
  ADD COLUMN status transaction_status NOT NULL DEFAULT 'COMPLETED',
  ADD COLUMN due_at TIMESTAMPTZ,
  ADD COLUMN settled_at TIMESTAMPTZ;

CREATE INDEX idx_transactions_pending ON transactions(tenant_id, status, due_at)
  WHERE deleted_at IS NULL AND status = 'PENDING';

-- v_calendar_feed gains the PAYMENT branch (same column set as 037 so the
-- CREATE OR REPLACE keeps the view's output columns stable).
CREATE OR REPLACE VIEW v_calendar_feed AS
SELECT
  e.tenant_id, 'EVENT' AS item_type, e.id, e.title, e.starts_at AS start_at,
  e.ends_at AS end_at, e.all_day, e.status::TEXT AS status, e.kind::TEXT AS kind,
  e.property_id, e.contact_id, NULL::BIGINT AS amount_cents
FROM events e
WHERE e.deleted_at IS NULL
UNION ALL
SELECT
  t.tenant_id, 'TASK' AS item_type, t.id, t.title, t.due_at AS start_at,
  NULL::TIMESTAMPTZ AS end_at, FALSE AS all_day, t.status::TEXT AS status,
  t.kind::TEXT AS kind, NULL::UUID AS property_id, NULL::UUID AS contact_id,
  NULL::BIGINT AS amount_cents
FROM tasks t
WHERE t.deleted_at IS NULL AND t.due_at IS NOT NULL AND t.status NOT IN ('DONE', 'CANCELLED')
UNION ALL
SELECT
  tr.tenant_id, 'PAYMENT' AS item_type, tr.id,
  COALESCE(tr.description, tr.category::TEXT) AS title, tr.due_at AS start_at,
  NULL::TIMESTAMPTZ AS end_at, FALSE AS all_day, tr.status::TEXT AS status,
  tr.category::TEXT AS kind, tr.related_property_id AS property_id,
  tr.payer_person_id AS contact_id, tr.amount_cents
FROM transactions tr
WHERE tr.deleted_at IS NULL AND tr.status = 'PENDING' AND tr.due_at IS NOT NULL;
