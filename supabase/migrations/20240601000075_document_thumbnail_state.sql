-- =====================================================================
-- document_versions: thumbnail lifecycle
--
-- `thumbnail_path IS NULL` conflates three very different situations: not
-- rendered yet, cannot be rendered (a mime we have no renderer for), and
-- tried and failed (a corrupt PDF). The on-demand endpoint treats the first
-- as work to do, so without a way to tell them apart a corrupt file is
-- re-rendered on every grid paint, forever, for every viewer.
--
-- `thumbnail_attempts` bounds the third case: three failures and the row is
-- marked FAILED and never picked up again.
-- =====================================================================

ALTER TABLE document_versions
  ADD COLUMN IF NOT EXISTS thumbnail_state TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS thumbnail_attempts SMALLINT NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'document_versions_thumbnail_state_chk'
  ) THEN
    ALTER TABLE document_versions
      ADD CONSTRAINT document_versions_thumbnail_state_chk
      CHECK (thumbnail_state IN ('PENDING', 'READY', 'UNSUPPORTED', 'FAILED'));
  END IF;
END $$;

-- Everything already rendered is READY; the default above only describes rows
-- written from here on.
UPDATE document_versions
   SET thumbnail_state = 'READY'
 WHERE thumbnail_path IS NOT NULL
   AND thumbnail_state <> 'READY';

-- Drives the backfill and the on-demand endpoint's "is there work here" check.
CREATE INDEX IF NOT EXISTS idx_document_versions_thumb_pending
  ON document_versions(tenant_id)
  WHERE thumbnail_state = 'PENDING';
