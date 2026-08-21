-- =====================================================================
-- Identity: a person has channels, and a role only inside a relationship.
--
-- `contacts.phone` and `contacts.email` are single TEXT columns with no
-- uniqueness (20240101000014:59). Two consequences, both live today:
--
--   * A person's second number is a different person. `client_agent.py` matches
--     `.eq("phone", e164)` and creates a contact when it misses; `email_sync.py`
--     matches `.ilike("%" || digits)` on the same column. Two rules, one column.
--   * `contacts.type` is a single-valued enum, so the same human cannot be the
--     owner of one property and a buyer on another deal — which is the normal
--     case in a brokerage, not an edge one.
--
-- Roles move into the relationship, where they belong. `contacts.type` stays as
-- a denormalized "main role" hint: fifteen call sites read it, and breaking all
-- of them at once buys nothing. It is no longer the truth.
--
-- Uniqueness is per person, not per tenant, and that is deliberate: a couple
-- shares a phone number, so two contacts holding the same e164 is legal. The
-- same number TWICE on one contact is not. Duplicate detection is therefore a
-- service (see contacts_find_duplicates), never a constraint.
-- =====================================================================

CREATE TABLE contact_phones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  -- Normalized on the way in by app.core.phone.to_e164. Storing anything else
  -- is what produced two different matching rules against one column.
  e164 TEXT NOT NULL,
  label TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (contact_id, e164)
);

-- The inbound webhook's lookup: given a number, whose is it?
CREATE INDEX idx_contact_phones_lookup ON contact_phones (tenant_id, e164);
CREATE UNIQUE INDEX idx_contact_phones_one_primary
  ON contact_phones (contact_id) WHERE is_primary;

CREATE TABLE contact_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  label TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_contact_emails_unique ON contact_emails (contact_id, lower(address));
CREATE INDEX idx_contact_emails_lookup ON contact_emails (tenant_id, lower(address));
CREATE UNIQUE INDEX idx_contact_emails_one_primary
  ON contact_emails (contact_id) WHERE is_primary;

-- --------------------------------------------------------------------
-- Backfill, then keep the legacy scalar columns as a mirror of the primary.
--
-- Both directions, because the transition has readers AND writers on the old
-- columns. Each trigger guards with IS DISTINCT FROM, so the mirrored write is
-- a no-op and the pair settles after one hop instead of recursing.
-- --------------------------------------------------------------------

INSERT INTO contact_phones (tenant_id, contact_id, e164, is_primary)
SELECT tenant_id, id, btrim(phone), true
FROM contacts
WHERE phone IS NOT NULL AND btrim(phone) <> ''
ON CONFLICT (contact_id, e164) DO NOTHING;

INSERT INTO contact_emails (tenant_id, contact_id, address, is_primary)
SELECT tenant_id, id, btrim(email), true
FROM contacts
WHERE email IS NOT NULL AND btrim(email) <> ''
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.sync_contact_primary_channel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target UUID := COALESCE(NEW.contact_id, OLD.contact_id);
  primary_value TEXT;
BEGIN
  IF TG_TABLE_NAME = 'contact_phones' THEN
    SELECT e164 INTO primary_value FROM contact_phones
     WHERE contact_id = target ORDER BY is_primary DESC, created_at LIMIT 1;
    UPDATE contacts SET phone = primary_value
     WHERE id = target AND phone IS DISTINCT FROM primary_value;
  ELSE
    SELECT address INTO primary_value FROM contact_emails
     WHERE contact_id = target ORDER BY is_primary DESC, created_at LIMIT 1;
    UPDATE contacts SET email = primary_value
     WHERE id = target AND email IS DISTINCT FROM primary_value;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_contact_phones_sync
AFTER INSERT OR UPDATE OR DELETE ON contact_phones
FOR EACH ROW EXECUTE FUNCTION public.sync_contact_primary_channel();

CREATE TRIGGER trg_contact_emails_sync
AFTER INSERT OR UPDATE OR DELETE ON contact_emails
FOR EACH ROW EXECUTE FUNCTION public.sync_contact_primary_channel();

-- The other direction: a legacy writer setting contacts.phone must not leave
-- the child table behind, or the webhook lookup misses a number the CRM shows.
CREATE OR REPLACE FUNCTION public.mirror_contact_channel_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.phone IS NOT NULL AND btrim(NEW.phone) <> '' THEN
    INSERT INTO contact_phones (tenant_id, contact_id, e164, is_primary)
    VALUES (NEW.tenant_id, NEW.id, btrim(NEW.phone),
            NOT EXISTS (SELECT 1 FROM contact_phones WHERE contact_id = NEW.id))
    ON CONFLICT (contact_id, e164) DO NOTHING;
  END IF;
  IF NEW.email IS NOT NULL AND btrim(NEW.email) <> '' THEN
    INSERT INTO contact_emails (tenant_id, contact_id, address, is_primary)
    VALUES (NEW.tenant_id, NEW.id, btrim(NEW.email),
            NOT EXISTS (SELECT 1 FROM contact_emails WHERE contact_id = NEW.id))
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_contacts_mirror_channels
AFTER INSERT OR UPDATE OF phone, email ON contacts
FOR EACH ROW EXECUTE FUNCTION public.mirror_contact_channel_columns();

-- --------------------------------------------------------------------
-- Role lives in the relationship.
-- --------------------------------------------------------------------

CREATE TABLE property_stakeholders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  -- Free text like interaction_participants.role: the vocabulary of who is
  -- attached to a property (propietario, copropietario, administrador,
  -- arrendatario) grows with the business, and a type would need a migration
  -- to follow it.
  role TEXT NOT NULL,
  share_pct NUMERIC(5, 2) CHECK (share_pct IS NULL OR (share_pct > 0 AND share_pct <= 100)),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (property_id, contact_id, role)
);

CREATE INDEX idx_property_stakeholders_property ON property_stakeholders (tenant_id, property_id);
CREATE INDEX idx_property_stakeholders_contact ON property_stakeholders (tenant_id, contact_id);

CREATE TABLE opportunity_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  -- comprador, cónyuge, propietario, corredor contraparte, abogado, ejecutivo
  role TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (opportunity_id, contact_id, role)
);

CREATE INDEX idx_opportunity_participants_opp ON opportunity_participants (tenant_id, opportunity_id);
CREATE INDEX idx_opportunity_participants_contact ON opportunity_participants (tenant_id, contact_id);

-- Seed the relationship tables from the singular FKs they replace, so the new
-- reads are not empty on day one.
INSERT INTO opportunity_participants (tenant_id, opportunity_id, contact_id, role)
SELECT tenant_id, id, person_id, 'comprador'
FROM opportunities
WHERE person_id IS NOT NULL AND deleted_at IS NULL
ON CONFLICT DO NOTHING;

-- --------------------------------------------------------------------
-- Contactability. Not paperwork: agent guards read these before writing.
-- --------------------------------------------------------------------

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS preferred_channel TEXT
    CHECK (preferred_channel IS NULL OR preferred_channel IN ('whatsapp', 'email', 'phone')),
  ADD COLUMN IF NOT EXISTS quiet_hours JSONB;

COMMENT ON COLUMN contacts.quiet_hours IS
  'When not to contact this person: {"from":"21:00","to":"09:00","tz":"America/Santiago"}.';
COMMENT ON COLUMN contacts.phone IS
  'Primary number, mirrored from contact_phones. Transitional: write to the child table.';
COMMENT ON COLUMN contacts.email IS
  'Primary address, mirrored from contact_emails. Transitional: write to the child table.';
COMMENT ON COLUMN contacts.type IS
  'Denormalized main role. The truth is property_stakeholders / opportunity_participants.';

-- --------------------------------------------------------------------
-- RLS, same shape as every other tenant-scoped table.
-- --------------------------------------------------------------------

ALTER TABLE contact_phones ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_stakeholders ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY contact_phones_tenant ON contact_phones FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id()) WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY contact_emails_tenant ON contact_emails FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id()) WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY property_stakeholders_tenant ON property_stakeholders FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id()) WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY opportunity_participants_tenant ON opportunity_participants FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id()) WITH CHECK (tenant_id = public.get_my_tenant_id());

SELECT public.attach_audit('contact_phones');
SELECT public.attach_audit('contact_emails');
SELECT public.attach_audit('property_stakeholders');
SELECT public.attach_audit('opportunity_participants');
