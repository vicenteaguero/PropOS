-- =====================================================================
-- documents: priority flag + last-opened stamp
--
-- Two things the documents list could not express. Ordering was by
-- `sort_order, created_at desc`, which is the order things arrived, not the
-- order anyone works in — the mandate you opened this morning sank under
-- whatever was scanned last. And a document that matters more than its
-- neighbours had no way to say so.
-- =====================================================================

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS last_opened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_priority BOOLEAN NOT NULL DEFAULT FALSE;

-- Sorting "recently opened first" within a tenant.
CREATE INDEX IF NOT EXISTS idx_documents_last_opened
  ON documents(tenant_id, last_opened_at DESC NULLS LAST)
  WHERE deleted_at IS NULL;

-- Priority documents are a small subset, so a partial index is the whole table
-- for the query that wants them.
CREATE INDEX IF NOT EXISTS idx_documents_priority
  ON documents(tenant_id)
  WHERE is_priority = TRUE AND deleted_at IS NULL;
