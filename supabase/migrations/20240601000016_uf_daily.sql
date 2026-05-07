-- =====================================================================
-- UF (Unidad de Fomento) daily snapshots — universal, not tenant-scoped.
-- Source: mindicador.cl (free public API).
-- =====================================================================

CREATE TABLE IF NOT EXISTS uf_daily (
  date DATE PRIMARY KEY,
  value_clp NUMERIC(12, 2) NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL DEFAULT 'mindicador.cl'
);

CREATE INDEX IF NOT EXISTS idx_uf_daily_date_desc ON uf_daily(date DESC);

ALTER TABLE uf_daily ENABLE ROW LEVEL SECURITY;

-- Any authenticated user reads.
CREATE POLICY uf_daily_read ON uf_daily FOR SELECT TO authenticated USING (true);

-- Service-role only writes (backend upserts via supabase service client).
