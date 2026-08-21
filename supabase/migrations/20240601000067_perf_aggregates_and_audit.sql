-- Performance pass, 2026-08-21. Three unrelated things that all reduce work
-- the database was doing for no benefit.
--
-- 1. finance_summary_totals(): aggregate in SQL instead of shipping every
--    transaction row to Python to be added up there.
-- 2. Trigram indexes on contacts.email / contacts.phone, so entity search stops
--    falling back to a sequential scan.
-- 3. The audit trigger only fires when a row actually changed.

-- ---------------------------------------------------------------------
-- 1. Finance totals, grouped in the database
-- ---------------------------------------------------------------------
-- FinanceService.summary paged through `transactions` a thousand rows at a
-- time (up to 100 pages) and summed them in Python. The answer is six numbers;
-- the transport was the whole table. This returns the same shape the Python
-- summariser already consumes — one row per (direction, status, currency) with
-- the amounts pre-added — so `summarize_by_currency` is unchanged and keeps its
-- tests.
--
-- SECURITY INVOKER, and tenant_id is an explicit argument rather than
-- `get_my_tenant_id()`: the backend calls this with the service-role key, under
-- which `auth.uid()` is null. The caller is responsible for passing the tenant
-- it has already resolved, exactly as the surrounding service code does for
-- every other query.
CREATE OR REPLACE FUNCTION public.finance_summary_totals(
  p_tenant_id UUID,
  p_from      TIMESTAMPTZ DEFAULT NULL,
  p_to        TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  direction    TEXT,
  status       TEXT,
  currency     TEXT,
  amount_cents BIGINT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    t.direction::TEXT,
    t.status::TEXT,
    COALESCE(t.currency, 'CLP')::TEXT,
    SUM(t.amount_cents)::BIGINT
  FROM public.transactions t
  WHERE t.tenant_id = p_tenant_id
    AND t.deleted_at IS NULL
    -- Half-open window, matching month_bounds_scl(): [first, next-month).
    AND (p_from IS NULL OR t.occurred_at >= p_from)
    AND (p_to   IS NULL OR t.occurred_at <  p_to)
  GROUP BY 1, 2, 3;
$$;

COMMENT ON FUNCTION public.finance_summary_totals(UUID, TIMESTAMPTZ, TIMESTAMPTZ)
  IS 'Pre-aggregated transaction totals per direction/status/currency.';

-- ---------------------------------------------------------------------
-- 2. Trigram indexes for the contact search
-- ---------------------------------------------------------------------
-- `idx_contacts_name_trgm` already covers the folded name column, but
-- search/service.py ORs it with `email ILIKE '%q%'` and `phone ILIKE '%q%'`,
-- and neither of those had an index a leading wildcard could use. One
-- unindexable branch in an OR makes the planner scan the table, so the
-- name index was never reached either:
--
--   Limit  (cost=0.00..29.63 rows=20)
--     ->  Seq Scan on contacts
--           Rows Removed by Filter: 235
--
-- Harmless at 250 contacts (12 ms measured). Seconds at 50,000.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_contacts_email_trgm
  ON public.contacts USING gin (email gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_contacts_phone_trgm
  ON public.contacts USING gin (phone gin_trgm_ops);

-- ---------------------------------------------------------------------
-- 3. Audit only what changed
-- ---------------------------------------------------------------------
-- `log_audit()` writes to_jsonb(OLD) AND to_jsonb(NEW) — two complete copies of
-- the row — on every UPDATE, whether or not anything differs. Combined with
-- `resolve_active_tenant` rewriting the profiles snapshot on every single API
-- request, that made `audit_log` the largest table in the database: 14,551 rows
-- and 22 MB, of which 9,427 (65%) were profile updates that changed nothing.
-- Bigger than all the real business data put together, and it buried the actual
-- role changes the log exists to record.
--
-- The backend fix stops those writes at the source. This stops the NEXT
-- idempotent update from doing the same thing, on any table.
--
-- Both helpers are recreated so every audited table inherits the guard the next
-- time it is attached; the loop below re-attaches the ones that exist today.
CREATE OR REPLACE FUNCTION public.attach_audit(p_table TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I ON %I', p_table, p_table);
  EXECUTE format(
    'CREATE TRIGGER trg_audit_%I '
    'AFTER INSERT OR DELETE ON %I '
    'FOR EACH ROW EXECUTE FUNCTION public.log_audit()',
    p_table, p_table
  );
  -- UPDATE gets its own trigger so it can carry a WHEN clause; INSERT and
  -- DELETE have no OLD/NEW pair to compare and must always fire.
  EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_upd_%I ON %I', p_table, p_table);
  EXECUTE format(
    'CREATE TRIGGER trg_audit_upd_%I '
    'AFTER UPDATE ON %I '
    'FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) '
    'EXECUTE FUNCTION public.log_audit()',
    p_table, p_table
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.attach_audit_keyed(
  p_table      TEXT,
  p_key_col    TEXT DEFAULT 'id',
  p_tenant_col TEXT DEFAULT 'tenant_id',
  p_ops        TEXT DEFAULT 'INSERT OR UPDATE OR DELETE'
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_ops  TEXT[] := regexp_split_to_array(upper(p_ops), '\s+OR\s+');
  v_rest TEXT;
BEGIN
  EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I ON %I', p_table, p_table);
  EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_upd_%I ON %I', p_table, p_table);

  IF 'UPDATE' = ANY (v_ops) THEN
    EXECUTE format(
      'CREATE TRIGGER trg_audit_upd_%I AFTER UPDATE ON %I '
      'FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) '
      'EXECUTE FUNCTION public.log_audit_keyed(%L, %L)',
      p_table, p_table, p_key_col, p_tenant_col
    );
  END IF;

  -- Everything that is not UPDATE keeps an unconditional trigger: INSERT and
  -- DELETE have no OLD/NEW pair to compare.
  SELECT string_agg(op, ' OR ') INTO v_rest
  FROM unnest(v_ops) AS op
  WHERE op <> 'UPDATE';

  IF v_rest IS NOT NULL THEN
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%I AFTER %s ON %I '
      'FOR EACH ROW EXECUTE FUNCTION public.log_audit_keyed(%L, %L)',
      p_table, v_rest, p_table, p_key_col, p_tenant_col
    );
  END IF;
END;
$$;

-- Re-attach every table that currently has an audit trigger, so they all pick
-- up the guard. The plain ones are driven off the catalogue rather than a
-- hand-written list, which would drift the moment a migration attaches a new
-- one.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT c.relname AS table_name
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE n.nspname = 'public'
      AND NOT t.tgisinternal
      AND p.proname = 'log_audit'
  LOOP
    EXECUTE format('SELECT public.attach_audit(%L)', r.table_name);
  END LOOP;
END;
$$;

-- The keyed ones carry their key/tenant columns as trigger arguments, which the
-- catalogue does not give back cleanly, so they are named here. Same pair as
-- migration ...0051.
SELECT public.attach_audit_keyed('tenant_memberships', 'user_id', 'tenant_id');
SELECT public.attach_audit_keyed('tenants', 'id', 'id', 'INSERT OR UPDATE');
