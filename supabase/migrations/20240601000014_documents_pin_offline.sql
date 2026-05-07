-- =====================================================================
-- documents: offline pin flag (PWA service worker caches pinned blobs)
-- =====================================================================

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS pin_offline BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_documents_pin_offline
  ON documents(tenant_id)
  WHERE pin_offline = TRUE AND deleted_at IS NULL;
