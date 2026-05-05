-- RPC: contacts_by_property
-- Returns contacts who appear in any interaction targeting a given property.
-- Used by GET /contacts?property_id=... to narrow the contact picker in
-- document upload / scanner finalize flows.
--
-- Join path:
--   contacts.id = interaction_participants.person_id
--   interaction_participants.interaction_id = interaction_targets.interaction_id
--   interaction_targets.property_id = p_property_id
--
-- Tenancy enforced via current JWT helper get_my_tenant_id().

CREATE OR REPLACE FUNCTION public.contacts_by_property(
  p_property_id UUID,
  p_query TEXT DEFAULT NULL,
  p_include_drafts BOOLEAN DEFAULT TRUE,
  p_include_deleted BOOLEAN DEFAULT FALSE,
  p_limit INT DEFAULT 100
)
RETURNS SETOF contacts
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT DISTINCT c.*
  FROM contacts c
  JOIN interaction_participants ip ON ip.person_id = c.id
  JOIN interaction_targets it ON it.interaction_id = ip.interaction_id
  WHERE it.property_id = p_property_id
    AND c.tenant_id = public.get_my_tenant_id()
    AND ip.tenant_id = public.get_my_tenant_id()
    AND it.tenant_id = public.get_my_tenant_id()
    AND (p_include_drafts OR c.is_draft = FALSE)
    AND (p_include_deleted OR c.deleted_at IS NULL)
    AND (p_query IS NULL OR c.full_name ILIKE '%' || p_query || '%')
  ORDER BY c.full_name
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.contacts_by_property(UUID, TEXT, BOOLEAN, BOOLEAN, INT) TO authenticated;
