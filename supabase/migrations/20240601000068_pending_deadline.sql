-- A proposal's deadline: when acting on it stops being possible in-channel.
--
-- The Pendientes queue had no clock at all. It sorted by `created_at DESC`, so
-- a proposal extracted from a WhatsApp message with two hours left in its
-- free-form window sat below one from a voice note that expires never. The
-- broker had no way to tell which of the two cost something to postpone.
--
-- The deadline comes from the conversation the proposal was extracted from:
-- `last_inbound_at + 24h`, WhatsApp's free-form reply window. Proposals with no
-- conversation behind them — the broker's own chat or voice turn — get NULL,
-- deliberately: inventing "vence en 6 horas" for those would be a fabricated
-- fact on the one screen whose entire job is to be checkable.
--
-- Note this does NOT expire anything. A passed deadline makes a proposal less
-- urgent to act on in-channel, not invalid: "crear tarea para Catalina" is
-- still a correct CRM write tomorrow. `status` stays `pending`; the UI renders
-- "Vencida" from the timestamp.

ALTER TABLE pending_proposals ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Partial: the only rows ever ordered by this are the open ones.
CREATE INDEX IF NOT EXISTS idx_pending_expires
  ON pending_proposals (tenant_id, expires_at)
  WHERE status = 'pending';

-- Backfill. `evidence->>'conversation_id'` is the only link that exists between
-- a proposal and the thread it came from.
UPDATE pending_proposals p
   SET expires_at = c.last_inbound_at + INTERVAL '24 hours'
  FROM client_conversations c
 WHERE p.status = 'pending'
   AND p.expires_at IS NULL
   AND c.last_inbound_at IS NOT NULL
   AND c.id = NULLIF(p.evidence ->> 'conversation_id', '')::uuid;
