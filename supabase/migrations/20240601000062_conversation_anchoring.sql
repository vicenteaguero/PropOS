-- =====================================================================
-- A conversation is ABOUT something, and somebody is waiting on it.
--
-- `client_conversations` links to a contact and nothing else -- no property,
-- no deal. The inbox shows a property today by joining opportunities to
-- properties IN THE BROWSER and taking the first open one, which is a guess
-- dressed as a fact. And `email_threads` exposes no inbound timestamp at all,
-- so "sin responder" is structurally impossible on the e-mail channel: the
-- frontend hardcodes `needsReply: false` for every email row.
--
-- Three things here:
--   1. targets, so a thread says what it is about (the note_targets pattern)
--   2. waiting_on + SLA, so "who is waiting on me" is a column, not a heuristic
--   3. templates as data, so adding one is not a deploy
-- =====================================================================

CREATE TYPE conversation_target_kind AS ENUM ('PROPERTY', 'OPPORTUNITY');

CREATE TABLE conversation_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES client_conversations(id) ON DELETE CASCADE,
  target_kind conversation_target_kind NOT NULL,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT conversation_targets_kind_id_check CHECK (
    (target_kind = 'PROPERTY'    AND property_id    IS NOT NULL AND opportunity_id IS NULL) OR
    (target_kind = 'OPPORTUNITY' AND opportunity_id IS NOT NULL AND property_id    IS NULL)
  )
);

CREATE UNIQUE INDEX idx_conversation_targets_property
  ON conversation_targets (conversation_id, property_id) WHERE property_id IS NOT NULL;
CREATE UNIQUE INDEX idx_conversation_targets_opportunity
  ON conversation_targets (conversation_id, opportunity_id) WHERE opportunity_id IS NOT NULL;
CREATE INDEX idx_conversation_targets_lookup ON conversation_targets (tenant_id, conversation_id);

-- Message level, for what the composer generates. A thread is about a property;
-- a single message IS the property being sent, and that distinction is what
-- lets the assistant say "you sent them Los Aromos on Tuesday".
CREATE TYPE message_target_kind AS ENUM ('PROPERTY', 'DOCUMENT', 'EVENT');

CREATE TABLE message_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_message_id UUID NOT NULL REFERENCES client_messages(id) ON DELETE CASCADE,
  target_kind message_target_kind NOT NULL,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  -- The traced public link that was actually sent, when there was one.
  share_link_id UUID REFERENCES share_links(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT message_targets_kind_id_check CHECK (
    (target_kind = 'PROPERTY' AND property_id IS NOT NULL AND document_id IS NULL AND event_id IS NULL) OR
    (target_kind = 'DOCUMENT' AND document_id IS NOT NULL AND property_id IS NULL AND event_id IS NULL) OR
    (target_kind = 'EVENT'    AND event_id    IS NOT NULL AND property_id IS NULL AND document_id IS NULL)
  )
);

CREATE INDEX idx_message_targets_message ON message_targets (tenant_id, client_message_id);
CREATE INDEX idx_message_targets_property ON message_targets (tenant_id, property_id)
  WHERE property_id IS NOT NULL;

-- Backfill from the one anchor that existed: the bot stashed the property it
-- was talking about in `metadata->>'property_id'` because there was nowhere
-- else to put it.
INSERT INTO conversation_targets (tenant_id, conversation_id, target_kind, property_id)
SELECT c.tenant_id, c.id, 'PROPERTY', (c.metadata->>'property_id')::UUID
FROM client_conversations c
JOIN properties p ON p.id = (c.metadata->>'property_id')::UUID
WHERE c.metadata->>'property_id' IS NOT NULL
ON CONFLICT DO NOTHING;

-- --------------------------------------------------------------------
-- Who is waiting, and until when.
-- --------------------------------------------------------------------

ALTER TABLE client_conversations
  ADD COLUMN IF NOT EXISTS waiting_on TEXT
    CHECK (waiting_on IS NULL OR waiting_on IN ('client', 'us', 'nobody')),
  ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_response_due_at TIMESTAMPTZ;

ALTER TABLE email_threads
  ADD COLUMN IF NOT EXISTS waiting_on TEXT
    CHECK (waiting_on IS NULL OR waiting_on IN ('client', 'us', 'nobody')),
  ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_response_due_at TIMESTAMPTZ,
  -- e-mail had no owner at all, so "assign this thread to someone" was a
  -- WhatsApp-only idea.
  ADD COLUMN IF NOT EXISTS assigned_user_id UUID REFERENCES auth.users(id),
  -- The missing timestamp. Without it `needsReply` cannot be computed for
  -- e-mail, which is why the inbox hardcodes false for that whole channel.
  ADD COLUMN IF NOT EXISTS last_inbound_at TIMESTAMPTZ;

--: How long we give ourselves to answer, before anybody configures otherwise.
CREATE OR REPLACE FUNCTION public.touch_conversation_waiting()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inbound BOOLEAN := (NEW.direction = 'inbound');
BEGIN
  UPDATE client_conversations
     SET waiting_on = CASE WHEN inbound THEN 'us' ELSE 'client' END,
         last_inbound_at = CASE WHEN inbound THEN NEW.created_at ELSE last_inbound_at END,
         -- Two hours is a starting point, not a policy: it exists so the
         -- column is never null and the UI has something to count down.
         first_response_due_at = CASE
           WHEN inbound AND waiting_on IS DISTINCT FROM 'us'
           THEN NEW.created_at + INTERVAL '2 hours' ELSE first_response_due_at END,
         first_response_at = CASE
           WHEN NOT inbound AND first_response_at IS NULL THEN NEW.created_at
           ELSE first_response_at END
   WHERE id = NEW.conversation_id;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_client_messages_waiting
AFTER INSERT ON client_messages
FOR EACH ROW EXECUTE FUNCTION public.touch_conversation_waiting();

CREATE OR REPLACE FUNCTION public.touch_email_thread_waiting()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inbound BOOLEAN := (NEW.direction = 'IN');
BEGIN
  UPDATE email_threads
     SET waiting_on = CASE WHEN inbound THEN 'us' ELSE 'client' END,
         last_inbound_at = CASE WHEN inbound THEN NEW.sent_at ELSE last_inbound_at END,
         first_response_due_at = CASE
           WHEN inbound AND waiting_on IS DISTINCT FROM 'us'
           THEN NEW.sent_at + INTERVAL '4 hours' ELSE first_response_due_at END,
         first_response_at = CASE
           WHEN NOT inbound AND first_response_at IS NULL THEN NEW.sent_at
           ELSE first_response_at END
   WHERE id = NEW.thread_id;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_email_messages_waiting
AFTER INSERT ON email_messages
FOR EACH ROW EXECUTE FUNCTION public.touch_email_thread_waiting();

-- Backfill both from the history already on disk.
UPDATE client_conversations c
   SET waiting_on = CASE
         WHEN c.status = 'closed' THEN 'nobody'
         WHEN c.last_inbound_at IS NOT NULL AND c.last_inbound_at >= c.last_message_at THEN 'us'
         ELSE 'client' END
 WHERE c.waiting_on IS NULL;

UPDATE email_threads t
   SET last_inbound_at = sub.last_in,
       waiting_on = CASE
         WHEN t.status = 'ARCHIVED' THEN 'nobody'
         WHEN sub.last_direction = 'IN' THEN 'us'
         ELSE 'client' END
  FROM (
    SELECT DISTINCT ON (thread_id)
           thread_id,
           direction AS last_direction,
           MAX(sent_at) FILTER (WHERE direction = 'IN') OVER (PARTITION BY thread_id) AS last_in
    FROM email_messages
    ORDER BY thread_id, sent_at DESC
  ) sub
 WHERE sub.thread_id = t.id AND t.waiting_on IS NULL;

CREATE INDEX idx_client_conversations_waiting
  ON client_conversations (tenant_id, waiting_on) WHERE archived_at IS NULL;
CREATE INDEX idx_email_threads_waiting ON email_threads (tenant_id, waiting_on);

-- --------------------------------------------------------------------
-- Templates as data.
--
-- Three frozen dataclasses in notifications/whatsapp/templates.py, so adding
-- one is a deploy and no tenant can have its own. Outside the 24 h window a
-- template is the ONLY thing that can be sent, which makes this the difference
-- between answering a client and not.
-- --------------------------------------------------------------------

CREATE TABLE message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'email')),
  category TEXT NOT NULL DEFAULT 'utility' CHECK (category IN ('utility', 'marketing', 'authentication')),
  language TEXT NOT NULL DEFAULT 'es',
  body TEXT NOT NULL,
  --: Ordered names mapped onto Meta's positional {{1}}..{{n}}.
  variables JSONB NOT NULL DEFAULT '[]',
  --: What it is called at Meta, which need not match our name.
  external_name TEXT,
  approval_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (approval_status IN ('draft', 'submitted', 'approved', 'rejected')),
  approved_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE INDEX idx_message_templates_usable
  ON message_templates (tenant_id, channel) WHERE approval_status = 'approved';

-- --------------------------------------------------------------------
-- A traced public link for a property, reusing the one that exists.
--
-- `share_links` already carries a slug, a view counter, an expiry, an optional
-- password and an audit trigger. It was document-only; a property link is the
-- same object pointed somewhere else.
-- --------------------------------------------------------------------

ALTER TABLE share_links
  ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE CASCADE;

ALTER TABLE share_links ALTER COLUMN document_id DROP NOT NULL;

ALTER TABLE share_links ADD CONSTRAINT share_links_one_target CHECK (
  (document_id IS NOT NULL AND property_id IS NULL) OR
  (property_id IS NOT NULL AND document_id IS NULL)
);

-- --------------------------------------------------------------------
-- RLS
-- --------------------------------------------------------------------

ALTER TABLE conversation_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_targets      ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates    ENABLE ROW LEVEL SECURITY;

CREATE POLICY conversation_targets_tenant ON conversation_targets FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id()) WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY message_targets_tenant ON message_targets FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id()) WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY message_templates_tenant ON message_templates FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id()) WITH CHECK (tenant_id = public.get_my_tenant_id());

SELECT public.attach_audit('conversation_targets');
SELECT public.attach_audit('message_templates');
