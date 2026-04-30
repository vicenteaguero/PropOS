-- =====================================================================
-- Interactions: visitas, llamadas, notas, emails, reuniones, showings.
-- Polymorphic via interaction_targets (can point at property/project/
-- opportunity simultaneously). Participants via interaction_participants.
-- =====================================================================

CREATE TYPE interaction_kind AS ENUM (
  'VISIT', 'CALL', 'EMAIL', 'WHATSAPP_LOG', 'NOTE',
  'MEETING', 'SHOWING', 'OTHER'
);

CREATE TYPE interaction_sentiment AS ENUM (
  'POSITIVE', 'NEUTRAL', 'NEGATIVE'
);


-- ---------------------------------------------------------------------
-- interactions
-- ---------------------------------------------------------------------
CREATE TABLE interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  kind interaction_kind NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_minutes INT,
  channel TEXT,
  summary TEXT,
  body TEXT,
  sentiment interaction_sentiment,
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'anita', 'import')),
  -- raw_transcript_id FK added in 0031 once anita_transcripts exists
  raw_transcript_id UUID,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_interactions_tenant ON interactions(tenant_id, occurred_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_interactions_kind ON interactions(tenant_id, kind, occurred_at DESC);

ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY interactions_tenant_select ON interactions FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY interactions_tenant_insert ON interactions FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY interactions_tenant_update ON interactions FOR UPDATE TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY interactions_tenant_delete ON interactions FOR DELETE TO authenticated
  USING (tenant_id = public.get_my_tenant_id());

CREATE TRIGGER trg_interactions_touch BEFORE UPDATE ON interactions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
SELECT public.attach_audit('interactions');


-- ---------------------------------------------------------------------
-- interaction_participants (M2M people↔interaction with role)
-- ---------------------------------------------------------------------
CREATE TABLE interaction_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  interaction_id UUID NOT NULL REFERENCES interactions(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  role TEXT,
  UNIQUE (interaction_id, person_id)
);
CREATE INDEX idx_iparticipants_interaction ON interaction_participants(interaction_id);
CREATE INDEX idx_iparticipants_person ON interaction_participants(person_id);
CREATE INDEX idx_iparticipants_tenant ON interaction_participants(tenant_id);

ALTER TABLE interaction_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY iparticipants_tenant_select ON interaction_participants FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY iparticipants_tenant_insert ON interaction_participants FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY iparticipants_tenant_delete ON interaction_participants FOR DELETE TO authenticated
  USING (tenant_id = public.get_my_tenant_id());


-- ---------------------------------------------------------------------
-- interaction_targets (polymorphic: property | project | opportunity)
-- ---------------------------------------------------------------------
CREATE TYPE interaction_target_kind AS ENUM ('PROPERTY', 'PROJECT', 'OPPORTUNITY', 'PLACE');

CREATE TABLE interaction_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  interaction_id UUID NOT NULL REFERENCES interactions(id) ON DELETE CASCADE,
  target_kind interaction_target_kind NOT NULL,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  -- project_id and opportunity_id added later in their own migrations
  -- via ALTER TABLE ADD COLUMN to keep ordering simple.
  place_id UUID REFERENCES places(id) ON DELETE CASCADE,
  CHECK (
    (target_kind = 'PROPERTY' AND property_id IS NOT NULL)
    OR (target_kind = 'PLACE' AND place_id IS NOT NULL)
    OR (target_kind IN ('PROJECT', 'OPPORTUNITY'))
  )
);
CREATE INDEX idx_itargets_interaction ON interaction_targets(interaction_id);
CREATE INDEX idx_itargets_property ON interaction_targets(property_id) WHERE property_id IS NOT NULL;
CREATE INDEX idx_itargets_place ON interaction_targets(place_id) WHERE place_id IS NOT NULL;
CREATE INDEX idx_itargets_tenant ON interaction_targets(tenant_id);

ALTER TABLE interaction_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY itargets_tenant_select ON interaction_targets FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY itargets_tenant_insert ON interaction_targets FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY itargets_tenant_delete ON interaction_targets FOR DELETE TO authenticated
  USING (tenant_id = public.get_my_tenant_id());
