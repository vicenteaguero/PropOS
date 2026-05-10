-- =====================================================================
-- interactions.audience_caps + audience-aware RLS for visits
--
-- Caps tokens: view, view_visitor_identity, view_visit_documents.
-- Property linkage via interaction_targets (kind=PROPERTY).
-- =====================================================================

ALTER TABLE interactions
  ADD COLUMN IF NOT EXISTS audience_caps JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.interaction_property_id(p_interaction UUID)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT property_id FROM interaction_targets
   WHERE interaction_id = p_interaction
     AND target_kind = 'PROPERTY'
     AND property_id IS NOT NULL
   LIMIT 1;
$$;

CREATE POLICY interactions_audience_select ON interactions FOR SELECT TO authenticated USING (
  public.user_has_property_cap(public.interaction_property_id(id), 'view_visits')
  AND public.audience_can(audience_caps, 'view')
);

COMMENT ON COLUMN interactions.audience_caps IS
  'JSONB {audience_view: [caps]}. Caps: view, view_visitor_identity, view_visit_documents.';
