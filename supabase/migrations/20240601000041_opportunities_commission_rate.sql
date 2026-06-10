-- Per-deal commission override. Falls back to tenants.settings.finance default.
ALTER TABLE opportunities
  ADD COLUMN commission_rate_pct NUMERIC(5, 2);
