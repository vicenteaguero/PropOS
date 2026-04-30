-- Atomic increment for share_links.view_count to avoid lost updates
-- under concurrent public access.

CREATE OR REPLACE FUNCTION public.increment_share_link_views(p_id UUID)
RETURNS INT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE share_links
  SET view_count = view_count + 1
  WHERE id = p_id
  RETURNING view_count;
$$;

-- Allow anon to call (public share resolution increments counter without auth).
GRANT EXECUTE ON FUNCTION public.increment_share_link_views(UUID) TO anon, authenticated;
