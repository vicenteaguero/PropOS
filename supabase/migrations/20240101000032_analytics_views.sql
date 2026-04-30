-- =====================================================================
-- Analytics: materialized views + plain views + RPC refresh.
-- =====================================================================

-- ---------------------------------------------------------------------
-- mv_revenue_monthly (transactions sum by month/category/direction)
-- ---------------------------------------------------------------------
CREATE MATERIALIZED VIEW mv_revenue_monthly AS
SELECT
  tenant_id,
  to_char(occurred_at, 'YYYY-MM') AS month,
  direction,
  category,
  currency,
  SUM(amount_cents) AS total_cents,
  COUNT(*) AS tx_count
FROM transactions
WHERE deleted_at IS NULL
GROUP BY tenant_id, to_char(occurred_at, 'YYYY-MM'), direction, category, currency;

CREATE UNIQUE INDEX idx_mv_revenue_unique
  ON mv_revenue_monthly(tenant_id, month, direction, category, currency);


-- ---------------------------------------------------------------------
-- mv_funnel_monthly (opportunities by stage by month)
-- ---------------------------------------------------------------------
CREATE MATERIALIZED VIEW mv_funnel_monthly AS
SELECT
  tenant_id,
  to_char(created_at, 'YYYY-MM') AS month,
  pipeline_stage,
  status,
  COUNT(*) AS opp_count,
  COALESCE(SUM(expected_value_cents), 0) AS expected_value_cents
FROM opportunities
WHERE deleted_at IS NULL
GROUP BY tenant_id, to_char(created_at, 'YYYY-MM'), pipeline_stage, status;

CREATE UNIQUE INDEX idx_mv_funnel_unique
  ON mv_funnel_monthly(tenant_id, month, pipeline_stage, status);


-- ---------------------------------------------------------------------
-- mv_ad_roi (campaign spend join opportunities won within campaign window)
-- ---------------------------------------------------------------------
CREATE MATERIALIZED VIEW mv_ad_roi AS
SELECT
  c.tenant_id,
  c.id AS campaign_id,
  c.name AS campaign_name,
  c.channel,
  c.budget_cents,
  COALESCE(SUM(t.amount_cents) FILTER (WHERE t.direction = 'OUT'), 0) AS spend_cents,
  COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'WON') AS won_count,
  COALESCE(SUM(o.expected_value_cents) FILTER (WHERE o.status = 'WON'), 0) AS won_value_cents
FROM campaigns c
LEFT JOIN transactions t
  ON t.related_campaign_id = c.id AND t.deleted_at IS NULL
LEFT JOIN opportunities o
  ON o.tenant_id = c.tenant_id
  AND o.deleted_at IS NULL
  AND (c.start_at IS NULL OR o.created_at >= c.start_at)
  AND (c.end_at IS NULL OR o.created_at <= c.end_at)
WHERE c.deleted_at IS NULL
GROUP BY c.tenant_id, c.id, c.name, c.channel, c.budget_cents;

CREATE UNIQUE INDEX idx_mv_ad_roi_unique ON mv_ad_roi(tenant_id, campaign_id);


-- ---------------------------------------------------------------------
-- mv_time_on_market (properties on/off market spans)
-- ---------------------------------------------------------------------
CREATE MATERIALIZED VIEW mv_time_on_market AS
SELECT
  tenant_id,
  id AS property_id,
  title,
  status,
  on_market_at,
  off_market_at,
  CASE
    WHEN off_market_at IS NOT NULL THEN
      EXTRACT(EPOCH FROM (off_market_at - on_market_at)) / 86400
    WHEN on_market_at IS NOT NULL THEN
      EXTRACT(EPOCH FROM (now() - on_market_at)) / 86400
    ELSE NULL
  END AS days_on_market
FROM properties
WHERE deleted_at IS NULL AND on_market_at IS NOT NULL;

CREATE UNIQUE INDEX idx_mv_tom_unique ON mv_time_on_market(property_id);


-- ---------------------------------------------------------------------
-- mv_person_activity (interactions/tasks/transactions per person per week)
-- ---------------------------------------------------------------------
CREATE MATERIALIZED VIEW mv_person_activity AS
SELECT
  tenant_id,
  person_id,
  to_char(occurred_at, 'IYYY-IW') AS week,
  COUNT(*) AS interaction_count
FROM (
  SELECT i.tenant_id, ip.person_id, i.occurred_at
  FROM interactions i
  JOIN interaction_participants ip ON ip.interaction_id = i.id
  WHERE i.deleted_at IS NULL
) sub
GROUP BY tenant_id, person_id, to_char(occurred_at, 'IYYY-IW');

CREATE UNIQUE INDEX idx_mv_pact_unique
  ON mv_person_activity(tenant_id, person_id, week);


-- ---------------------------------------------------------------------
-- v_open_pending_review (real-time count helper)
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_open_pending_review AS
SELECT
  tenant_id,
  COUNT(*) AS pending_count,
  MAX(created_at) AS most_recent
FROM pending_proposals
WHERE status = 'pending'
GROUP BY tenant_id;


-- ---------------------------------------------------------------------
-- v_pipeline_status (real-time pipeline snapshot)
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_pipeline_status AS
SELECT
  tenant_id,
  pipeline_stage,
  COUNT(*) AS opp_count,
  COALESCE(SUM(expected_value_cents), 0) AS expected_value_cents
FROM opportunities
WHERE deleted_at IS NULL AND status = 'OPEN'
GROUP BY tenant_id, pipeline_stage;


-- ---------------------------------------------------------------------
-- v_entity_timeline (audit + interactions + tasks + notes for any row)
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_entity_timeline AS
SELECT
  a.tenant_id,
  a.table_name,
  a.row_id,
  a.changed_at AS event_at,
  'audit' AS event_type,
  a.op AS event_subtype,
  a.source AS source,
  a.changed_by AS actor,
  jsonb_build_object('before', a.before, 'after', a.after) AS payload
FROM audit_log a
UNION ALL
SELECT
  i.tenant_id,
  it.target_kind::TEXT AS table_name,
  COALESCE(it.property_id, it.project_id, it.opportunity_id, it.place_id) AS row_id,
  i.occurred_at AS event_at,
  'interaction' AS event_type,
  i.kind::TEXT AS event_subtype,
  i.source,
  i.created_by AS actor,
  jsonb_build_object('summary', i.summary, 'body', i.body) AS payload
FROM interactions i
JOIN interaction_targets it ON it.interaction_id = i.id
WHERE i.deleted_at IS NULL
UNION ALL
SELECT
  n.tenant_id,
  n.target_table AS table_name,
  n.target_row_id AS row_id,
  n.created_at AS event_at,
  'note' AS event_type,
  NULL AS event_subtype,
  n.source,
  n.created_by AS actor,
  jsonb_build_object('body', n.body) AS payload
FROM notes n
WHERE n.deleted_at IS NULL AND n.target_row_id IS NOT NULL;


-- ---------------------------------------------------------------------
-- refresh_analytics RPC (called by nightly cron + manual button)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_analytics()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_revenue_monthly;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_funnel_monthly;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_ad_roi;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_time_on_market;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_person_activity;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_analytics() TO authenticated;
