-- Persist original camera shots + per-shot edit states for CAMERA-origin docs.
-- Lets the unified scanner editor re-hydrate raw bitmaps + EditState for re-cropping.
-- source_image_paths: ordered list of storage object paths (one per page/shot).
-- source_edit_states: ordered list of EditState dicts (1:1 with source_image_paths).

ALTER TABLE document_versions
  ADD COLUMN IF NOT EXISTS source_image_paths TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS source_edit_states JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN document_versions.source_image_paths IS
  'Ordered storage paths of original camera shots (one per page). Empty unless origin=CAMERA with raw shots persisted.';
COMMENT ON COLUMN document_versions.source_edit_states IS
  'Ordered EditState JSON objects, 1:1 with source_image_paths. Used to restore the scanner editor.';
