-- =====================================================================
-- RPC: count user-role agent messages in the last 24h for a given user.
-- Used by backend to enforce a per-user daily turn quota on the free tier.
-- =====================================================================

CREATE OR REPLACE FUNCTION agent_user_turns_today(p_user_id UUID)
RETURNS INTEGER
LANGUAGE SQL
STABLE
AS $$
  SELECT COUNT(*)::INTEGER
  FROM agent_messages m
  JOIN agent_sessions s ON s.id = m.session_id
  WHERE s.user_id = p_user_id
    AND m.role = 'user'
    AND m.created_at >= NOW() - INTERVAL '1 day';
$$;

COMMENT ON FUNCTION agent_user_turns_today IS
  'Counts user-role agent_messages in the rolling 24h for a given user. Drives free-tier daily quota.';
