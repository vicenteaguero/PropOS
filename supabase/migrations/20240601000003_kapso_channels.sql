-- =====================================================================
-- Kapso (WhatsApp) channel integration
-- =====================================================================
-- Two flows share one WhatsApp number:
--   1. Anita-over-WhatsApp — internal user texting; reuses anita_sessions.
--   2. Client Agent (B2C) — external contact; new client_conversations.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Extend anita_sessions / anita_messages with channel metadata
-- ---------------------------------------------------------------------
ALTER TABLE anita_sessions
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'pwa'
    CHECK (source IN ('pwa', 'whatsapp')),
  ADD COLUMN IF NOT EXISTS external_thread_id TEXT;

CREATE INDEX IF NOT EXISTS idx_anita_sessions_external_thread
  ON anita_sessions(tenant_id, source, external_thread_id)
  WHERE external_thread_id IS NOT NULL;

ALTER TABLE anita_messages
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'pwa'
    CHECK (source IN ('pwa', 'whatsapp')),
  ADD COLUMN IF NOT EXISTS external_message_id TEXT,
  ADD COLUMN IF NOT EXISTS delivery_status TEXT
    CHECK (delivery_status IN ('queued', 'sent', 'delivered', 'read', 'failed'));

CREATE UNIQUE INDEX IF NOT EXISTS uniq_anita_messages_external
  ON anita_messages(source, external_message_id)
  WHERE external_message_id IS NOT NULL;


-- ---------------------------------------------------------------------
-- 2. user_phones — map E.164 phone → internal user (route inbound to Anita)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_phones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_e164 TEXT NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (phone_e164)
);
CREATE INDEX IF NOT EXISTS idx_user_phones_tenant ON user_phones(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_phones_user ON user_phones(user_id);

ALTER TABLE user_phones ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_phones_own_select ON user_phones FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id() AND user_id = auth.uid());
CREATE POLICY user_phones_own_insert ON user_phones FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id() AND user_id = auth.uid());
CREATE POLICY user_phones_own_delete ON user_phones FOR DELETE TO authenticated
  USING (tenant_id = public.get_my_tenant_id() AND user_id = auth.uid());


-- ---------------------------------------------------------------------
-- 3. client_conversations — channel-agnostic B2C threads
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS client_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  source TEXT NOT NULL CHECK (source IN ('whatsapp', 'email', 'web')),
  external_thread_id TEXT,
  external_phone_e164 TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'assigned', 'closed')),
  assigned_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ai_enabled BOOLEAN NOT NULL DEFAULT true,
  last_inbound_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB
);
CREATE INDEX IF NOT EXISTS idx_client_conv_tenant_status
  ON client_conversations(tenant_id, status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_conv_contact
  ON client_conversations(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_client_conv_phone
  ON client_conversations(tenant_id, source, external_phone_e164)
  WHERE external_phone_e164 IS NOT NULL;

ALTER TABLE client_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY client_conv_tenant_select ON client_conversations FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY client_conv_tenant_insert ON client_conversations FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY client_conv_tenant_update ON client_conversations FOR UPDATE TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());

ALTER PUBLICATION supabase_realtime ADD TABLE client_conversations;


-- ---------------------------------------------------------------------
-- 4. client_messages — turns within client_conversations
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS client_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES client_conversations(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  sender_type TEXT NOT NULL CHECK (sender_type IN ('contact', 'agent_ai', 'agent_human')),
  sender_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  media_url TEXT,
  media_mime TEXT,
  external_message_id TEXT,
  template_name TEXT,
  delivery_status TEXT NOT NULL DEFAULT 'queued'
    CHECK (delivery_status IN ('queued', 'sent', 'delivered', 'read', 'failed')),
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_client_msgs_conv
  ON client_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_client_msgs_tenant
  ON client_messages(tenant_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_client_msgs_external
  ON client_messages(external_message_id)
  WHERE external_message_id IS NOT NULL;

ALTER TABLE client_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY client_msgs_tenant_select ON client_messages FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY client_msgs_tenant_insert ON client_messages FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id());

ALTER PUBLICATION supabase_realtime ADD TABLE client_messages;


-- ---------------------------------------------------------------------
-- 5. client_consents — opt-in per contact per channel
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS client_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email')),
  opted_in_at TIMESTAMPTZ,
  opted_out_at TIMESTAMPTZ,
  method TEXT
    CHECK (method IN ('broker_attestation', 'webform_checkbox', 'inbound_reply', 'imported')),
  proof JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, contact_id, channel)
);
CREATE INDEX IF NOT EXISTS idx_client_consents_tenant
  ON client_consents(tenant_id);

ALTER TABLE client_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY client_consents_tenant_select ON client_consents FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY client_consents_tenant_insert ON client_consents FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY client_consents_tenant_update ON client_consents FOR UPDATE TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());


-- ---------------------------------------------------------------------
-- 6. kapso_webhook_events — append-only forensic log of raw webhook payloads
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kapso_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_event_id TEXT,
  signature_valid BOOLEAN NOT NULL,
  event_type TEXT,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ,
  process_error TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_kapso_event_id
  ON kapso_webhook_events(external_event_id)
  WHERE external_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_kapso_events_received
  ON kapso_webhook_events(received_at DESC);

-- No RLS; service role only (webhook endpoint uses service client).
