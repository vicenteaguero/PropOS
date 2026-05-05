-- Server-rendered first-page PNG thumbnails for documents grid.
-- Generated synchronously on PDF upload via pypdfium2; ~400px tall, ≤30KB.
-- thumbnail_path: storage object path under bucket `documents` at
-- `{tenant_id}/4_thumbnails/{document_id}/v{n}.png`. NULL for non-PDF
-- versions or when generation failed (best-effort, never blocks upload).

ALTER TABLE document_versions
  ADD COLUMN IF NOT EXISTS thumbnail_path TEXT NULL;

COMMENT ON COLUMN document_versions.thumbnail_path IS
  'Storage path of server-rendered first-page PNG thumbnail. NULL when not a PDF or generation failed.';
