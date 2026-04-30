-- =====================================================================
-- People unified: extend contacts (kept) with new kinds + soft delete +
-- aliases for AI fuzzy matching.
-- =====================================================================
-- Documents already FK to contacts.id, so we keep the table name.
-- "people" view exposes the active subset for new callers.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Trigram extension (used by Anita find_person fuzzy search)
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;


-- ---------------------------------------------------------------------
-- Extend contact_type enum
-- ---------------------------------------------------------------------
ALTER TYPE contact_type ADD VALUE IF NOT EXISTS 'INVESTOR';
ALTER TYPE contact_type ADD VALUE IF NOT EXISTS 'EMPLOYEE';
ALTER TYPE contact_type ADD VALUE IF NOT EXISTS 'FAMILY';
ALTER TYPE contact_type ADD VALUE IF NOT EXISTS 'VENDOR';
ALTER TYPE contact_type ADD VALUE IF NOT EXISTS 'STAKEHOLDER';


-- ---------------------------------------------------------------------
-- Extend contacts table
-- ---------------------------------------------------------------------
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS rut TEXT,
  ADD COLUMN IF NOT EXISTS birthdate DATE,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS merged_into_id UUID REFERENCES contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_active ON contacts(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_name_trgm ON contacts USING gin (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_contacts_rut ON contacts(tenant_id, rut) WHERE rut IS NOT NULL;


-- ---------------------------------------------------------------------
-- person_aliases — Anita matches "Juan", "Juanito", "J. Pérez"
-- ---------------------------------------------------------------------
CREATE TABLE person_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, person_id, alias)
);
CREATE INDEX idx_person_aliases_person ON person_aliases(person_id);
CREATE INDEX idx_person_aliases_alias_trgm ON person_aliases USING gin (alias gin_trgm_ops);
CREATE INDEX idx_person_aliases_tenant ON person_aliases(tenant_id);

ALTER TABLE person_aliases ENABLE ROW LEVEL SECURITY;
CREATE POLICY person_aliases_tenant_select ON person_aliases FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY person_aliases_tenant_insert ON person_aliases FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY person_aliases_tenant_update ON person_aliases FOR UPDATE TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY person_aliases_tenant_delete ON person_aliases FOR DELETE TO authenticated
  USING (tenant_id = public.get_my_tenant_id());

SELECT public.attach_audit('person_aliases');


-- ---------------------------------------------------------------------
-- people view (active contacts only)
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW people AS
SELECT * FROM contacts WHERE deleted_at IS NULL;
