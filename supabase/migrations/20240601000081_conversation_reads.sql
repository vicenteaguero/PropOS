-- =====================================================================
-- Unread, with a real count.
--
-- The inbox had no notion of "read" at all. Every filter it offered was a
-- property of the CONVERSATION (`waiting_on`, `status`, `archived_at`), which
-- says what stage the thread is at, not whether the person looking at the
-- screen has seen the last message. Two brokers sharing a number saw the same
-- state, and a thread you had just replied to still looked exactly like one
-- you had never opened.
--
-- Per user and per conversation, because "read" is a fact about a person.
-- =====================================================================

CREATE TABLE IF NOT EXISTS conversation_reads (
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES client_conversations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Everything created at or before this instant is read. A timestamp rather
  -- than a message id: messages arrive out of order often enough (a webhook
  -- retry, a backfill) that "up to this id" is not the same as "up to now".
  read_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_reads_user
  ON conversation_reads(tenant_id, user_id);

ALTER TABLE conversation_reads ENABLE ROW LEVEL SECURITY;

-- A read marker is private to its owner. Not merely tenant-scoped: whether a
-- colleague has read a thread is not information the product exposes, and an
-- UPDATE policy scoped only by tenant would let anyone mark anyone else's.
DROP POLICY IF EXISTS conversation_reads_own_select ON conversation_reads;
CREATE POLICY conversation_reads_own_select ON conversation_reads FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id() AND user_id = auth.uid());
DROP POLICY IF EXISTS conversation_reads_own_insert ON conversation_reads;
CREATE POLICY conversation_reads_own_insert ON conversation_reads FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id() AND user_id = auth.uid());
DROP POLICY IF EXISTS conversation_reads_own_update ON conversation_reads;
CREATE POLICY conversation_reads_own_update ON conversation_reads FOR UPDATE TO authenticated
  USING (tenant_id = public.get_my_tenant_id() AND user_id = auth.uid())
  WITH CHECK (tenant_id = public.get_my_tenant_id() AND user_id = auth.uid());
DROP POLICY IF EXISTS conversation_reads_own_delete ON conversation_reads;
CREATE POLICY conversation_reads_own_delete ON conversation_reads FOR DELETE TO authenticated
  USING (tenant_id = public.get_my_tenant_id() AND user_id = auth.uid());

-- ---------------------------------------------------------------------
-- The counts, in one query
-- ---------------------------------------------------------------------
-- Counting inbound messages newer than the caller's marker, for every thread
-- at once. Doing this per conversation from the API would be one round trip
-- per row on a 200-row inbox.
CREATE OR REPLACE FUNCTION public.conversation_unread_counts(p_tenant UUID, p_user UUID)
RETURNS TABLE (conversation_id UUID, unread_count BIGINT, last_preview TEXT)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH threads AS (
    SELECT c.id, r.read_at
    FROM client_conversations c
    LEFT JOIN conversation_reads r
      ON r.conversation_id = c.id AND r.user_id = p_user
    WHERE c.tenant_id = p_tenant
  ),
  counted AS (
    SELECT t.id,
           COUNT(m.id) FILTER (
             WHERE m.direction = 'inbound'
               AND (t.read_at IS NULL OR m.created_at > t.read_at)
           ) AS unread_count
    FROM threads t
    LEFT JOIN client_messages m ON m.conversation_id = t.id
    GROUP BY t.id
  ),
  latest AS (
    -- The last message of each thread, whichever way it went. The inbox had
    -- no preview at all because the list endpoint never touched this table.
    SELECT DISTINCT ON (m.conversation_id)
           m.conversation_id, m.content
    FROM client_messages m
    JOIN threads t ON t.id = m.conversation_id
    ORDER BY m.conversation_id, m.created_at DESC
  )
  SELECT c.id, COALESCE(c.unread_count, 0), l.content
  FROM counted c
  LEFT JOIN latest l ON l.conversation_id = c.id;
$$;

GRANT EXECUTE ON FUNCTION public.conversation_unread_counts(UUID, UUID) TO authenticated;
