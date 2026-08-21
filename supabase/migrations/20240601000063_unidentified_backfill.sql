-- =====================================================================
-- The contacts the bot invented.
--
-- Until today an unknown WhatsApp number minted a contact whose `full_name` was
-- its own phone number, typed BUYER because the column needed something, with
-- no consent evidence and no dedup (channels/client_agent.py). They are
-- indistinguishable from real rows in the list, which is why nobody noticed.
--
-- They are not deleted: some of them ARE real people whose name simply never
-- got filled in, and their conversation history hangs off them. They are
-- flagged, so the Personas list can offer to identify them and the data-health
-- check can count them.
-- =====================================================================

UPDATE contacts
   SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('needs_identity', true)
 WHERE deleted_at IS NULL
   AND full_name IS NOT NULL
   -- The tell: the name is the phone number, in any of the spellings the bot
   -- could have written it in.
   AND regexp_replace(full_name, '\D', '', 'g') <> ''
   AND regexp_replace(full_name, '\D', '', 'g') = regexp_replace(COALESCE(phone, ''), '\D', '', 'g');

COMMENT ON COLUMN contacts.metadata IS
  'Free-form. Known keys: channel_origin, created_via, agent_session_id, needs_identity.';
