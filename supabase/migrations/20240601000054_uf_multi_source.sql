-- =====================================================================
-- UF daily snapshots: multiple sources + published forward values.
--
-- The UF is issued by the Banco Central de Chile (Ley 18.010 art. 35); SII,
-- CMF and mindicador.cl all republish the same number. The backend now tries
-- them in order (settings.uf_sources, default "sii,mindicador"), so `source`
-- must be written explicitly on every row instead of leaning on a default
-- that silently claimed mindicador for everything.
--
-- The table already accepts dates after today; that is deliberate. The UF for
-- a whole 10th -> 9th window is published in advance, so forward rows are
-- official values, not projections. Reads that mean "current value" filter
-- date <= today.
-- =====================================================================

ALTER TABLE uf_daily ALTER COLUMN source DROP DEFAULT;

-- Existing rows predate the provider chain and all came from mindicador.
UPDATE uf_daily SET source = 'mindicador.cl' WHERE source IS NULL OR source = '';

COMMENT ON COLUMN uf_daily.source IS
  'Provider that supplied the row: sii.cl | cmf.cl | mindicador.cl.';
COMMENT ON COLUMN uf_daily.date IS
  'May be later than today: the UF is published in advance for the 10th -> 9th window.';
