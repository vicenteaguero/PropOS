-- Adds editor metadata + raw source pointer to document_versions.
-- edit_metadata: { source_version_id, quad: [[x,y]x4], filter: 'bw'|'enhance'|'none', auto_detected: bool }
-- source_raw_path: 1_raw path of the parent (pre-edit) version, used to restore the original.

ALTER TABLE document_versions
  ADD COLUMN IF NOT EXISTS edit_metadata JSONB,
  ADD COLUMN IF NOT EXISTS source_raw_path TEXT;

CREATE INDEX IF NOT EXISTS idx_versions_source_raw_path
  ON document_versions(source_raw_path)
  WHERE source_raw_path IS NOT NULL;
