-- =====================================================================
-- Anita conversation persistence
-- =====================================================================
-- - anita_sessions: chat threads (one OPEN per user typically)
-- - anita_messages: turns (role: user/assistant/tool/system)
-- - anita_transcripts: audio transcription forensic record (NEVER lost,
--   even if chat fails or proposal rejected)
-- - anita_tool_calls: tool invocations log (for debugging + cost tracking)
-- =====================================================================


-- ---------------------------------------------------------------------
-- anita_sessions
-- ---------------------------------------------------------------------
CREATE TABLE anita_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'CLOSED')),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ
);
CREATE INDEX idx_anita_sessions_user ON anita_sessions(user_id, status, last_activity_at DESC);
CREATE INDEX idx_anita_sessions_tenant ON anita_sessions(tenant_id, last_activity_at DESC);

ALTER TABLE anita_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY anita_sessions_own_select ON anita_sessions FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id() AND user_id = auth.uid());
CREATE POLICY anita_sessions_own_insert ON anita_sessions FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id() AND user_id = auth.uid());
CREATE POLICY anita_sessions_own_update ON anita_sessions FOR UPDATE TO authenticated
  USING (tenant_id = public.get_my_tenant_id() AND user_id = auth.uid())
  WITH CHECK (tenant_id = public.get_my_tenant_id() AND user_id = auth.uid());


-- ---------------------------------------------------------------------
-- anita_messages
-- ---------------------------------------------------------------------
CREATE TABLE anita_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES anita_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool', 'system')),
  -- Content blocks preserved as JSONB array (text + tool_use + tool_result)
  content JSONB NOT NULL,
  -- Provider tokens accounting
  provider TEXT,
  model TEXT,
  tokens_in INT,
  tokens_out INT,
  cost_cents INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_anita_messages_session ON anita_messages(session_id, created_at);
CREATE INDEX idx_anita_messages_tenant ON anita_messages(tenant_id, created_at DESC);

ALTER TABLE anita_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY anita_messages_own_select ON anita_messages FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_my_tenant_id()
    AND EXISTS (
      SELECT 1 FROM anita_sessions s
      WHERE s.id = session_id AND s.user_id = auth.uid()
    )
  );
CREATE POLICY anita_messages_own_insert ON anita_messages FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id());

ALTER PUBLICATION supabase_realtime ADD TABLE anita_messages;


-- ---------------------------------------------------------------------
-- anita_transcripts (audio → text, NEVER lost)
-- ---------------------------------------------------------------------
CREATE TABLE anita_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_id UUID REFERENCES anita_sessions(id) ON DELETE SET NULL,
  message_id UUID REFERENCES anita_messages(id) ON DELETE SET NULL,
  -- Original audio (if any) — may be NULL if browser_speech without blob upload
  media_file_id UUID REFERENCES media_files(id) ON DELETE SET NULL,
  source TEXT NOT NULL
    CHECK (source IN ('browser_speech', 'groq_whisper', 'openai_whisper', 'manual_text')),
  provider TEXT,
  model TEXT,
  language TEXT,
  duration_seconds NUMERIC(8, 2),
  text TEXT NOT NULL,
  raw_response JSONB,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_anita_transcripts_session ON anita_transcripts(session_id, created_at);
CREATE INDEX idx_anita_transcripts_tenant ON anita_transcripts(tenant_id, created_at DESC);

ALTER TABLE anita_transcripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY anita_transcripts_tenant_select ON anita_transcripts FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY anita_transcripts_tenant_insert ON anita_transcripts FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id());


-- ---------------------------------------------------------------------
-- anita_tool_calls (debug + cost tracking)
-- ---------------------------------------------------------------------
CREATE TABLE anita_tool_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES anita_messages(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  input JSONB NOT NULL,
  output JSONB,
  status TEXT NOT NULL CHECK (status IN ('ok', 'error', 'rejected', 'malformed')),
  error_text TEXT,
  latency_ms INT,
  -- If this tool call produced a pending proposal, link it
  proposal_id UUID REFERENCES pending_proposals(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_anita_tool_calls_message ON anita_tool_calls(message_id);
CREATE INDEX idx_anita_tool_calls_tenant ON anita_tool_calls(tenant_id, created_at DESC);
CREATE INDEX idx_anita_tool_calls_proposal ON anita_tool_calls(proposal_id) WHERE proposal_id IS NOT NULL;

ALTER TABLE anita_tool_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY anita_tool_calls_tenant_select ON anita_tool_calls FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY anita_tool_calls_tenant_insert ON anita_tool_calls FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id());


-- ---------------------------------------------------------------------
-- Resolve forward FK from interactions.raw_transcript_id (set in 0024)
-- ---------------------------------------------------------------------
ALTER TABLE interactions
  ADD CONSTRAINT fk_interactions_raw_transcript
  FOREIGN KEY (raw_transcript_id) REFERENCES anita_transcripts(id) ON DELETE SET NULL;
