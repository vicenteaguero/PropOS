-- =====================================================================
-- note_targets: a note can point at MANY records, not one.
--
-- `notes.target_table` / `notes.target_row_id` (20240101000030:59-73) allow a
-- single soft link, and being a text/uuid pair they cannot be joined, cascaded
-- or trusted -- a deleted contact leaves the note pointing at nothing. A note
-- about a visit is really about the property AND the buyer AND the deal, so
-- one slot was always the wrong shape.
--
-- Same shape and RLS as `interaction_targets` (20240101000024:80-111): a kind
-- enum plus one typed, cascading FK column per kind. Typed columns are what
-- make the link real -- the FK removes the dangling-pointer case the old pair
-- had, and a resolver can join instead of guessing.
--
-- The legacy columns stay: the agent's note writer (`tools/executors.py:461`)
-- still fills them, and dropping them would break it. They are the fallback
-- read path, not a second source of truth -- the API unions both.
-- =====================================================================

CREATE TYPE note_target_kind AS ENUM (
  'PROPERTY', 'CONTACT', 'OPPORTUNITY', 'EVENT', 'PROJECT', 'PLACE'
);

CREATE TABLE note_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  target_kind note_target_kind NOT NULL,
  -- `contacts` rather than the `people` view: a view cannot be referenced.
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  place_id UUID REFERENCES places(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Stricter than interaction_targets' original CHECK, whose third branch was
  -- unconditional and had to be repaired later (20240601000052). Both halves
  -- are required: the kind's column is set, and no other column is -- so a row
  -- can never point at two records or at none.
  CONSTRAINT note_targets_kind_id_check CHECK (
    (
      (target_kind = 'PROPERTY'    AND property_id    IS NOT NULL)
      OR (target_kind = 'CONTACT'     AND contact_id     IS NOT NULL)
      OR (target_kind = 'OPPORTUNITY' AND opportunity_id IS NOT NULL)
      OR (target_kind = 'EVENT'       AND event_id       IS NOT NULL)
      OR (target_kind = 'PROJECT'     AND project_id     IS NOT NULL)
      OR (target_kind = 'PLACE'       AND place_id       IS NOT NULL)
    )
    AND (
      (property_id    IS NOT NULL)::INT
      + (contact_id     IS NOT NULL)::INT
      + (opportunity_id IS NOT NULL)::INT
      + (event_id       IS NOT NULL)::INT
      + (project_id     IS NOT NULL)::INT
      + (place_id       IS NOT NULL)::INT
    ) = 1
  )
);

CREATE INDEX idx_note_targets_note ON note_targets(note_id);
CREATE INDEX idx_note_targets_tenant ON note_targets(tenant_id);
-- One index per kind: the "notes for this record" query filters on exactly one
-- of these columns, and the partial predicate keeps each index to its own rows.
CREATE INDEX idx_note_targets_property ON note_targets(property_id) WHERE property_id IS NOT NULL;
CREATE INDEX idx_note_targets_contact ON note_targets(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX idx_note_targets_opportunity ON note_targets(opportunity_id) WHERE opportunity_id IS NOT NULL;
CREATE INDEX idx_note_targets_event ON note_targets(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX idx_note_targets_project ON note_targets(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX idx_note_targets_place ON note_targets(place_id) WHERE place_id IS NOT NULL;

-- Idempotent linking: re-attaching the same record to the same note is a no-op
-- rather than a duplicate chip. Partial uniques instead of one composite key
-- because the unused columns are NULL and NULL never collides.
CREATE UNIQUE INDEX uq_note_targets_property ON note_targets(note_id, property_id) WHERE property_id IS NOT NULL;
CREATE UNIQUE INDEX uq_note_targets_contact ON note_targets(note_id, contact_id) WHERE contact_id IS NOT NULL;
CREATE UNIQUE INDEX uq_note_targets_opportunity ON note_targets(note_id, opportunity_id) WHERE opportunity_id IS NOT NULL;
CREATE UNIQUE INDEX uq_note_targets_event ON note_targets(note_id, event_id) WHERE event_id IS NOT NULL;
CREATE UNIQUE INDEX uq_note_targets_project ON note_targets(note_id, project_id) WHERE project_id IS NOT NULL;
CREATE UNIQUE INDEX uq_note_targets_place ON note_targets(note_id, place_id) WHERE place_id IS NOT NULL;

ALTER TABLE note_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY note_targets_tenant_select ON note_targets FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY note_targets_tenant_insert ON note_targets FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY note_targets_tenant_delete ON note_targets FOR DELETE TO authenticated
  USING (tenant_id = public.get_my_tenant_id());

SELECT public.attach_audit('note_targets');


-- ---------------------------------------------------------------------
-- Backfill the existing single pair.
--
-- One INSERT per kind, each joined to its entity table so a pair pointing at a
-- deleted row is dropped instead of failing the FK. The join also enforces
-- same-tenant, which the loose pair never did.
--
-- `notes.target_table` holds the physical table name the writers use:
-- 'contacts' (NOT the `people` view), 'properties', 'opportunities', 'events'
-- -- see `scripts/seed_demo/core.py:_build_notes` and the agent's note intent.
-- ---------------------------------------------------------------------
INSERT INTO note_targets (tenant_id, note_id, target_kind, property_id, created_by)
SELECT n.tenant_id, n.id, 'PROPERTY', p.id, n.created_by
  FROM notes n
  JOIN properties p ON p.id = n.target_row_id AND p.tenant_id = n.tenant_id
 WHERE n.target_table = 'properties' AND n.target_row_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO note_targets (tenant_id, note_id, target_kind, contact_id, created_by)
SELECT n.tenant_id, n.id, 'CONTACT', c.id, n.created_by
  FROM notes n
  JOIN contacts c ON c.id = n.target_row_id AND c.tenant_id = n.tenant_id
 WHERE n.target_table IN ('contacts', 'people') AND n.target_row_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO note_targets (tenant_id, note_id, target_kind, opportunity_id, created_by)
SELECT n.tenant_id, n.id, 'OPPORTUNITY', o.id, n.created_by
  FROM notes n
  JOIN opportunities o ON o.id = n.target_row_id AND o.tenant_id = n.tenant_id
 WHERE n.target_table = 'opportunities' AND n.target_row_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO note_targets (tenant_id, note_id, target_kind, event_id, created_by)
SELECT n.tenant_id, n.id, 'EVENT', e.id, n.created_by
  FROM notes n
  JOIN events e ON e.id = n.target_row_id AND e.tenant_id = n.tenant_id
 WHERE n.target_table = 'events' AND n.target_row_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO note_targets (tenant_id, note_id, target_kind, project_id, created_by)
SELECT n.tenant_id, n.id, 'PROJECT', pr.id, n.created_by
  FROM notes n
  JOIN projects pr ON pr.id = n.target_row_id AND pr.tenant_id = n.tenant_id
 WHERE n.target_table = 'projects' AND n.target_row_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO note_targets (tenant_id, note_id, target_kind, place_id, created_by)
SELECT n.tenant_id, n.id, 'PLACE', pl.id, n.created_by
  FROM notes n
  JOIN places pl ON pl.id = n.target_row_id AND pl.tenant_id = n.tenant_id
 WHERE n.target_table = 'places' AND n.target_row_id IS NOT NULL
ON CONFLICT DO NOTHING;


-- ---------------------------------------------------------------------
-- Attachment reads: notes borrow the polymorphic `media_assets` table that
-- property photos already use (target_table='notes'), so nothing new is
-- created here. This index is what keeps "attachments of these N notes" a
-- single indexed lookup instead of a scan of every tenant's media.
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_media_assets_tenant_target
  ON media_assets(tenant_id, target_table, target_row_id);
