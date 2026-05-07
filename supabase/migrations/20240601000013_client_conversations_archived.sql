-- =====================================================================
-- client_conversations: archive support
-- =====================================================================

ALTER TABLE client_conversations
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

DROP INDEX IF EXISTS idx_client_conv_tenant_status;

CREATE INDEX idx_client_conv_tenant_active
  ON client_conversations(tenant_id, last_message_at DESC)
  WHERE archived_at IS NULL;

CREATE INDEX idx_client_conv_tenant_archived
  ON client_conversations(tenant_id, archived_at DESC)
  WHERE archived_at IS NOT NULL;
