-- What people actually did in the app, as opposed to what the servers did.
--
-- Cloud Monitoring answers "how many requests" and "how much CPU". It cannot
-- answer "did my father find the property form", "how long was Ana in the app",
-- "which screen did they open and immediately leave" -- and those are the only
-- questions worth asking in the first week with real users.
--
-- Measured on the CLIENT, deliberately. A server-side middleware sees requests,
-- and a request is a poor proxy for attention: a screen read for four minutes
-- with no scrolling makes zero requests, while opening one page can make six.
-- It also cannot see a tab that is open but not looked at.
--
-- Two tables because they answer different questions at different costs:
-- `usage_events` is the raw stream, written constantly and read rarely;
-- `usage_daily` is the rolled-up shape every chart reads.

CREATE TABLE IF NOT EXISTS usage_events (
  id          BIGSERIAL PRIMARY KEY,
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- page_view | action | session_ping
  kind        TEXT NOT NULL CHECK (kind IN ('page_view', 'action', 'session_ping')),
  -- A canonical route (`/admin/personas/:id`) or an action name. Never a raw
  -- URL: the ids in one would put customer data in a telemetry key.
  key         TEXT NOT NULL,
  meta        JSONB NOT NULL DEFAULT '{}',
  -- Stamped by the client, which is the only party that knows when the thing
  -- happened -- events are buffered and flushed in batches, so the server's
  -- clock would compress a quiet ten minutes into one instant.
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_events_tenant_time
  ON usage_events (tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_rollup
  ON usage_events (tenant_id, user_id, occurred_at);

CREATE TABLE IF NOT EXISTS usage_daily (
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day            DATE NOT NULL,
  page_views     INT NOT NULL DEFAULT 0,
  actions        INT NOT NULL DEFAULT 0,
  -- Distinct one-minute buckets carrying at least one event. Measures attention
  -- rather than session length: a tab left open all afternoon contributes only
  -- the minutes something actually happened in.
  active_minutes INT NOT NULL DEFAULT 0,
  first_seen     TIMESTAMPTZ,
  last_seen      TIMESTAMPTZ,
  PRIMARY KEY (tenant_id, user_id, day)
);

ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_daily ENABLE ROW LEVEL SECURITY;

-- Insert-only for the person the row is about. No SELECT policy: reading usage
-- is an admin question and goes through the service role, so one broker cannot
-- read another's activity by pointing PostgREST at the table.
CREATE POLICY usage_events_self_insert ON usage_events FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id() AND user_id = auth.uid());

-- The rollup is written by the internal job (service role) and read by the
-- dashboard through the backend, so `authenticated` gets nothing here either.

COMMENT ON TABLE usage_events IS
  'Client-side usage stream: page views, named actions, session pings. '
  'Rolled up daily into usage_daily by /internal/jobs/rollup-usage, which also '
  'purges events older than 90 days.';

-- The rollup, in SQL rather than in Python: it is one GROUP BY over an indexed
-- range, and pulling every raw event over PostgREST to count them in the
-- application would be the slow way to get the same number.
--
-- Recomputes whole days rather than accumulating, so a duplicate scheduler fire
-- (at-least-once delivery) produces the same rows instead of double counts.
CREATE OR REPLACE FUNCTION rollup_usage_daily(days_back INT DEFAULT 2)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  touched INT;
BEGIN
  INSERT INTO usage_daily AS d (
    tenant_id, user_id, day, page_views, actions, active_minutes, first_seen, last_seen
  )
  SELECT
    e.tenant_id,
    e.user_id,
    (e.occurred_at AT TIME ZONE 'America/Santiago')::date AS day,
    count(*) FILTER (WHERE e.kind = 'page_view'),
    count(*) FILTER (WHERE e.kind = 'action'),
    count(DISTINCT date_trunc('minute', e.occurred_at)),
    min(e.occurred_at),
    max(e.occurred_at)
  FROM usage_events e
  WHERE e.occurred_at >= now() - make_interval(days => days_back)
  GROUP BY 1, 2, 3
  ON CONFLICT (tenant_id, user_id, day) DO UPDATE SET
    page_views     = EXCLUDED.page_views,
    actions        = EXCLUDED.actions,
    active_minutes = EXCLUDED.active_minutes,
    first_seen     = LEAST(d.first_seen, EXCLUDED.first_seen),
    last_seen      = GREATEST(d.last_seen, EXCLUDED.last_seen);

  GET DIAGNOSTICS touched = ROW_COUNT;

  -- The raw stream is a means to the rollup, not an archive. Ninety days is
  -- well past the point where anyone asks about a specific afternoon.
  DELETE FROM usage_events WHERE occurred_at < now() - INTERVAL '90 days';

  RETURN touched;
END;
$$;

-- Same rule as refresh_analytics: the job runs as service role, and no browser
-- session has any business recomputing the rollup.
REVOKE EXECUTE ON FUNCTION rollup_usage_daily(INT) FROM PUBLIC, authenticated, anon;
