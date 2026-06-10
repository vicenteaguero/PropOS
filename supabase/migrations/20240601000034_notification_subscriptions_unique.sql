-- ---------------------------------------------------------------------
-- Make push subscriptions idempotent by endpoint.
--
-- A web-push endpoint is globally unique per browser/device. The client
-- re-subscribes on every load, so without a unique key we accumulate
-- duplicate rows and fan-out sends N times. Add UNIQUE(endpoint) so the
-- backend can upsert on_conflict="endpoint", plus updated_at for touch.
-- ---------------------------------------------------------------------

-- Drop any pre-existing duplicates, keeping the most recent row per endpoint.
DELETE FROM notification_subscriptions a
USING notification_subscriptions b
WHERE a.endpoint = b.endpoint
  AND a.created_at < b.created_at;

ALTER TABLE notification_subscriptions
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE notification_subscriptions
  ADD CONSTRAINT notification_subscriptions_endpoint_key UNIQUE (endpoint);

CREATE TRIGGER trg_notification_subscriptions_touch
  BEFORE UPDATE ON notification_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
