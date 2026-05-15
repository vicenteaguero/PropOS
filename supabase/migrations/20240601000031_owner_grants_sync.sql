-- Reconcile interaction_participants(role='owner') with property_grants.
-- A "legal owner" registered as participant should automatically get baseline
-- ACCESS (property_grant) if the contact has an auth account. Admin still
-- controls per-doc/visit audience_caps unlocks.

-- 1) Link contacts (CRM contact) → auth user, when the same email exists in profiles.
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS contacts_user_id_idx ON contacts(user_id) WHERE user_id IS NOT NULL;

UPDATE contacts p
   SET user_id = pr.id
  FROM profiles pr
 WHERE p.user_id IS NULL
   AND lower(p.email) = lower(pr.email)
   AND p.tenant_id = pr.tenant_id;

-- 2) Trigger: when a person becomes 'owner' of an interaction targeted at a
-- property, mirror that to property_grants with default read-only caps.
-- Idempotent (UNIQUE user_id+property_id handles re-firing).
CREATE OR REPLACE FUNCTION public.sync_owner_property_grant()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id  UUID;
  v_property UUID;
  v_tenant   UUID;
BEGIN
  IF NEW.role <> 'owner' THEN
    RETURN NEW;
  END IF;

  SELECT user_id, tenant_id INTO v_user_id, v_tenant FROM contacts WHERE id = NEW.person_id;
  IF v_user_id IS NULL THEN
    RETURN NEW;  -- contact has no auth account; admin can grant manually later
  END IF;

  SELECT property_id INTO v_property
    FROM interaction_targets
   WHERE interaction_id = NEW.interaction_id AND target_kind = 'PROPERTY'
   LIMIT 1;
  IF v_property IS NULL THEN
    RETURN NEW;  -- interaction not on a property
  END IF;

  INSERT INTO property_grants (user_id, property_id, tenant_id, view, capabilities, granted_by)
  VALUES (v_user_id, v_property, v_tenant, 'owner'::user_view,
          ARRAY['view_property','view_documents','view_visits']::TEXT[],
          auth.uid())
  ON CONFLICT (user_id, property_id) DO NOTHING;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_sync_owner_property_grant ON interaction_participants;
CREATE TRIGGER trg_sync_owner_property_grant
  AFTER INSERT OR UPDATE OF role, person_id ON interaction_participants
  FOR EACH ROW EXECUTE FUNCTION public.sync_owner_property_grant();

-- 3) Backfill existing owners.
INSERT INTO property_grants (user_id, property_id, tenant_id, view, capabilities)
SELECT DISTINCT pe.user_id, it.property_id, ip.tenant_id, 'owner'::user_view,
       ARRAY['view_property','view_documents','view_visits']::TEXT[]
  FROM interaction_participants ip
  JOIN contacts pe              ON pe.id = ip.person_id
  JOIN interaction_targets it ON it.interaction_id = ip.interaction_id
 WHERE ip.role = 'owner'
   AND pe.user_id IS NOT NULL
   AND it.target_kind = 'PROPERTY'
ON CONFLICT (user_id, property_id) DO NOTHING;

COMMENT ON COLUMN contacts.user_id IS
  'Optional link from CRM contact to auth user. Matches by email at creation.';
COMMENT ON FUNCTION public.sync_owner_property_grant() IS
  'Mirror interaction_participant(role=owner) → property_grants. Default caps read-only.';
