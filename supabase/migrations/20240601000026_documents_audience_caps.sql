-- =====================================================================
-- documents.audience_caps + property_id denorm + audience-aware RLS
--
-- audience_caps shape: {"<view>": ["<cap>", ...]} e.g. {"owner": ["view","download"]}
-- property_id denormalized from document_assignments(target_kind='PROPERTY')
-- so RLS policies are cheap (no join in policy expression).
-- =====================================================================

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS audience_caps JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS property_id   UUID REFERENCES properties(id) ON DELETE SET NULL;

-- Backfill property_id from document_assignments (one row per doc, take first PROPERTY target).
UPDATE documents d
   SET property_id = sub.property_id
  FROM (
    SELECT DISTINCT ON (document_id) document_id, property_id
      FROM document_assignments
     WHERE target_kind = 'PROPERTY' AND property_id IS NOT NULL
     ORDER BY document_id, created_at
  ) sub
 WHERE sub.document_id = d.id
   AND d.property_id IS NULL;

CREATE INDEX IF NOT EXISTS documents_property_idx
  ON documents(property_id) WHERE property_id IS NOT NULL;

-- ADD policy (alongside existing tenant policy). Non-admin views with a
-- property_grant + matching audience_caps see the doc; admin keeps all
-- via the existing tenant_id-based policy.
CREATE POLICY documents_audience_select ON documents FOR SELECT TO authenticated USING (
  property_id IS NOT NULL
  AND public.user_has_property_cap(property_id, 'view_documents')
  AND public.audience_can(audience_caps, 'view')
);

COMMENT ON COLUMN documents.audience_caps IS
  'JSONB {audience_view: [caps]}. Admin sets to "unlock" the document for non-admin views.';
COMMENT ON COLUMN documents.property_id IS
  'Denorm of document_assignments(target_kind=PROPERTY) for cheap RLS.';
