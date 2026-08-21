-- =====================================================================
-- Merging two people into one.
--
-- `contacts.merged_into_id` has existed since 20240101000022 and nothing ever
-- wrote to it, because merging is the one CRM operation PostgREST cannot do
-- safely: it repoints eighteen foreign keys plus two soft pointers, and a
-- half-finished merge leaves a person's history split across two rows with no
-- way to tell which half is which.
--
-- So it is a function. All of it commits, or none of it does.
--
-- Duplicates are found, never prevented: a couple legitimately shares a phone
-- number, so a unique constraint on (tenant, phone) would reject real data.
-- Detection proposes; a human decides.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.contacts_find_duplicates(
  p_tenant_id UUID,
  p_limit INT DEFAULT 50
)
RETURNS TABLE (
  contact_id UUID,
  duplicate_id UUID,
  reason TEXT,
  score NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH active AS (
    SELECT id, tenant_id, full_name, rut
    FROM contacts
    WHERE tenant_id = p_tenant_id AND deleted_at IS NULL AND merged_into_id IS NULL
  ),
  -- Same dialable number. The strongest signal short of a RUT.
  by_phone AS (
    SELECT a.contact_id AS l, b.contact_id AS r, 'mismo teléfono'::TEXT AS reason, 0.90::NUMERIC AS score
    FROM contact_phones a
    JOIN contact_phones b
      ON a.e164 = b.e164 AND a.contact_id < b.contact_id AND a.tenant_id = b.tenant_id
    WHERE a.tenant_id = p_tenant_id
  ),
  by_email AS (
    SELECT a.contact_id, b.contact_id, 'mismo correo'::TEXT, 0.95::NUMERIC
    FROM contact_emails a
    JOIN contact_emails b
      ON lower(a.address) = lower(b.address) AND a.contact_id < b.contact_id AND a.tenant_id = b.tenant_id
    WHERE a.tenant_id = p_tenant_id
  ),
  -- A RUT is a national identity number: sharing one is not a coincidence.
  by_rut AS (
    SELECT a.id, b.id, 'mismo RUT'::TEXT, 0.99::NUMERIC
    FROM active a JOIN active b ON a.rut = b.rut AND a.id < b.id
    WHERE a.rut IS NOT NULL AND btrim(a.rut) <> ''
  ),
  -- Near-identical names are only a duplicate WITH corroboration, which is why
  -- the threshold is high and this ranks below the others.
  by_name AS (
    SELECT a.id, b.id, 'nombre casi idéntico'::TEXT, 0.60::NUMERIC
    FROM active a JOIN active b
      ON a.id < b.id AND similarity(a.full_name, b.full_name) > 0.85
  ),
  merged AS (
    SELECT * FROM by_phone
    UNION ALL SELECT * FROM by_email
    UNION ALL SELECT * FROM by_rut
    UNION ALL SELECT * FROM by_name
  )
  SELECT l, r, reason, score
  FROM (
    SELECT l, r, reason, score,
           ROW_NUMBER() OVER (PARTITION BY l, r ORDER BY score DESC) AS rank
    FROM merged
  ) ranked
  WHERE rank = 1
  ORDER BY score DESC
  LIMIT p_limit;
$$;

CREATE OR REPLACE FUNCTION public.contacts_merge(
  p_tenant_id UUID,
  p_winner UUID,
  p_loser UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  moved INT;
BEGIN
  IF p_winner = p_loser THEN
    RAISE EXCEPTION 'cannot merge a contact into itself';
  END IF;
  -- Both sides must belong to the caller's tenant. The service role bypasses
  -- RLS, so an id alone would otherwise be enough to fold another brokerage's
  -- contact into yours.
  PERFORM 1 FROM contacts WHERE id = p_winner AND tenant_id = p_tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'winner % not in tenant', p_winner; END IF;
  PERFORM 1 FROM contacts WHERE id = p_loser AND tenant_id = p_tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'loser % not in tenant', p_loser; END IF;

  -- Channels: the winner keeps its primary, the loser's numbers come along as
  -- secondaries. ON CONFLICT because both may already hold the same number --
  -- which is very often exactly why they were flagged as duplicates.
  UPDATE contact_phones SET contact_id = p_winner, is_primary = false
   WHERE contact_id = p_loser
     AND e164 NOT IN (SELECT e164 FROM contact_phones WHERE contact_id = p_winner);
  DELETE FROM contact_phones WHERE contact_id = p_loser;

  UPDATE contact_emails SET contact_id = p_winner, is_primary = false
   WHERE contact_id = p_loser
     AND lower(address) NOT IN (SELECT lower(address) FROM contact_emails WHERE contact_id = p_winner);
  DELETE FROM contact_emails WHERE contact_id = p_loser;

  -- The loser's name becomes an alias, so a future search for it still lands.
  INSERT INTO person_aliases (tenant_id, person_id, alias)
  SELECT p_tenant_id, p_winner, full_name FROM contacts WHERE id = p_loser
  ON CONFLICT (tenant_id, person_id, alias) DO NOTHING;
  UPDATE person_aliases SET person_id = p_winner WHERE person_id = p_loser
    AND alias NOT IN (SELECT alias FROM person_aliases WHERE person_id = p_winner);
  DELETE FROM person_aliases WHERE person_id = p_loser;

  -- Plain repoints.
  UPDATE opportunities            SET person_id = p_winner       WHERE person_id = p_loser;
  UPDATE client_conversations     SET contact_id = p_winner      WHERE contact_id = p_loser;
  UPDATE email_threads            SET contact_id = p_winner      WHERE contact_id = p_loser;
  UPDATE email_messages           SET contact_id = p_winner      WHERE contact_id = p_loser;
  UPDATE events                   SET contact_id = p_winner      WHERE contact_id = p_loser;
  UPDATE transactions             SET payer_person_id = p_winner WHERE payer_person_id = p_loser;
  UPDATE visitor_invitations      SET contact_id = p_winner      WHERE contact_id = p_loser;
  UPDATE anonymous_upload_portals SET default_contact_id = p_winner WHERE default_contact_id = p_loser;

  -- Repoints with a uniqueness constraint to respect: move what does not
  -- collide, drop what does.
  UPDATE interaction_participants SET person_id = p_winner
   WHERE person_id = p_loser
     AND interaction_id NOT IN (SELECT interaction_id FROM interaction_participants WHERE person_id = p_winner);
  DELETE FROM interaction_participants WHERE person_id = p_loser;

  UPDATE opportunity_participants SET contact_id = p_winner
   WHERE contact_id = p_loser
     AND (opportunity_id, role) NOT IN (
       SELECT opportunity_id, role FROM opportunity_participants WHERE contact_id = p_winner);
  DELETE FROM opportunity_participants WHERE contact_id = p_loser;

  UPDATE property_stakeholders SET contact_id = p_winner
   WHERE contact_id = p_loser
     AND (property_id, role) NOT IN (
       SELECT property_id, role FROM property_stakeholders WHERE contact_id = p_winner);
  DELETE FROM property_stakeholders WHERE contact_id = p_loser;

  UPDATE note_targets SET contact_id = p_winner
   WHERE contact_id = p_loser
     AND note_id NOT IN (SELECT note_id FROM note_targets WHERE contact_id = p_winner);
  DELETE FROM note_targets WHERE contact_id = p_loser;

  UPDATE document_assignments SET contact_id = p_winner
   WHERE contact_id = p_loser
     AND document_id NOT IN (SELECT document_id FROM document_assignments WHERE contact_id = p_winner);
  DELETE FROM document_assignments WHERE contact_id = p_loser;

  -- Consent is per (tenant, contact, channel). Keep the STRICTER answer: an
  -- opt-out on either row wins, because merging two people must never quietly
  -- re-subscribe somebody who asked to be left alone.
  UPDATE client_consents w
     SET opted_out_at = COALESCE(w.opted_out_at, l.opted_out_at),
         opted_in_at  = CASE WHEN COALESCE(w.opted_out_at, l.opted_out_at) IS NOT NULL
                             THEN w.opted_in_at ELSE COALESCE(w.opted_in_at, l.opted_in_at) END
    FROM client_consents l
   WHERE l.contact_id = p_loser AND w.contact_id = p_winner
     AND l.channel = w.channel AND l.tenant_id = w.tenant_id;
  UPDATE client_consents SET contact_id = p_winner
   WHERE contact_id = p_loser
     AND channel NOT IN (SELECT channel FROM client_consents WHERE contact_id = p_winner);
  DELETE FROM client_consents WHERE contact_id = p_loser;

  -- Soft pointers: no FK, so no cascade would have caught these.
  UPDATE notes SET target_row_id = p_winner
   WHERE target_table = 'contacts' AND target_row_id = p_loser;
  UPDATE taggings SET target_row_id = p_winner
   WHERE target_table = 'contacts' AND target_row_id = p_loser
     AND tag_id NOT IN (
       SELECT tag_id FROM taggings WHERE target_table = 'contacts' AND target_row_id = p_winner);
  DELETE FROM taggings WHERE target_table = 'contacts' AND target_row_id = p_loser;

  -- tasks.related is {"contacts": [ids]} -- a jsonb array, so swap the element.
  UPDATE tasks
     SET related = jsonb_set(
           related, '{contacts}',
           (SELECT COALESCE(jsonb_agg(DISTINCT CASE WHEN v = to_jsonb(p_loser::TEXT)
                                                    THEN to_jsonb(p_winner::TEXT) ELSE v END), '[]'::jsonb)
              FROM jsonb_array_elements(related -> 'contacts') v))
   WHERE tenant_id = p_tenant_id AND related -> 'contacts' @> to_jsonb(ARRAY[p_loser::TEXT]);

  -- Finally the tombstone. The loser stays readable so an old link resolves,
  -- and points at where its history went.
  UPDATE contacts
     SET merged_into_id = p_winner,
         deleted_at = COALESCE(deleted_at, now())
   WHERE id = p_loser;

  GET DIAGNOSTICS moved = ROW_COUNT;
  IF moved = 0 THEN RAISE EXCEPTION 'merge did not close out loser %', p_loser; END IF;

  RETURN p_winner;
END;
$$;

REVOKE ALL ON FUNCTION public.contacts_merge(UUID, UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.contacts_find_duplicates(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contacts_merge(UUID, UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.contacts_find_duplicates(UUID, INT) TO service_role;
