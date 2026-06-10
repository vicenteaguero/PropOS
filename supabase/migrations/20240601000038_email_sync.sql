-- =====================================================================
-- Email sync: pull a Titan mailbox over IMAP, thread portal lead emails
-- into the CRM, reply via Resend. Credentials live in env/secrets, NOT here.
-- =====================================================================

CREATE TABLE email_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  label TEXT,
  email_address TEXT NOT NULL,
  username TEXT NOT NULL,
  imap_host TEXT NOT NULL DEFAULT 'imap.titan.email',
  imap_port INT NOT NULL DEFAULT 993,
  folder TEXT NOT NULL DEFAULT 'INBOX',
  last_seen_uid BIGINT NOT NULL DEFAULT 0,
  uidvalidity BIGINT,
  last_synced_at TIMESTAMPTZ,
  last_error TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (tenant_id, email_address)
);

CREATE TABLE email_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  subject TEXT,
  root_message_id TEXT,
  counterpart_email TEXT,
  counterpart_name TEXT,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  first_message_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ,
  message_count INT NOT NULL DEFAULT 0,
  is_lead BOOLEAN NOT NULL DEFAULT FALSE,
  portal TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ARCHIVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  thread_id UUID NOT NULL REFERENCES email_threads(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('IN', 'OUT')),
  message_id TEXT NOT NULL,
  in_reply_to TEXT,
  references_ids TEXT[],
  from_email TEXT,
  from_name TEXT,
  to_emails TEXT[],
  cc_emails TEXT[],
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  snippet TEXT,
  sent_at TIMESTAMPTZ NOT NULL,
  imap_uid BIGINT,
  folder TEXT,
  is_lead_email BOOLEAN NOT NULL DEFAULT FALSE,
  portal TEXT,
  parsed_lead JSONB,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  resend_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, message_id)
);

CREATE INDEX idx_email_threads_tenant ON email_threads(tenant_id, last_message_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_email_threads_contact ON email_threads(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX idx_email_messages_thread ON email_messages(thread_id, sent_at);
CREATE INDEX idx_email_messages_tenant ON email_messages(tenant_id, sent_at DESC);
CREATE INDEX idx_email_messages_contact ON email_messages(contact_id) WHERE contact_id IS NOT NULL;

ALTER TABLE email_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY email_accounts_tenant ON email_accounts FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id()) WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY email_threads_tenant ON email_threads FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id()) WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY email_messages_tenant ON email_messages FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id()) WITH CHECK (tenant_id = public.get_my_tenant_id());

CREATE TRIGGER trg_email_accounts_touch BEFORE UPDATE ON email_accounts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_email_threads_touch BEFORE UPDATE ON email_threads
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
SELECT public.attach_audit('email_accounts');
SELECT public.attach_audit('email_threads');
