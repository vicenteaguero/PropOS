-- =====================================================================
-- A deal is a relationship between people and properties, with a legal path.
--
-- Today `opportunities` holds one `person_id` and one `property_id`, and
-- `pipeline_stage` is bare TEXT with no check, no FK and no declared
-- transitions -- every move is legal, including straight from LEAD to CLOSED.
-- That is fine while only humans move deals. It stops being fine the moment an
-- AI can: autonomy needs to know which moves are legal and which need a person.
--
-- `opportunity_participants` landed in 20240601000059. This adds the property
-- side, the transition table, and the file a deal becomes after the handshake.
-- =====================================================================

CREATE TABLE opportunity_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  -- An interested buyer sees three and offers on one. Without this the CRM
  -- cannot answer "what else did they look at", which is the whole follow-up.
  role TEXT NOT NULL DEFAULT 'interest'
    CHECK (role IN ('interest', 'offered', 'closed', 'discarded')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (opportunity_id, property_id)
);

CREATE INDEX idx_opportunity_properties_opp ON opportunity_properties (tenant_id, opportunity_id);
CREATE INDEX idx_opportunity_properties_prop ON opportunity_properties (tenant_id, property_id);

-- Seed from the singular FK so the new read is not empty on day one.
INSERT INTO opportunity_properties (tenant_id, opportunity_id, property_id, role)
SELECT tenant_id, id, property_id,
       CASE WHEN status = 'WON' THEN 'closed' ELSE 'interest' END
FROM opportunities
WHERE property_id IS NOT NULL AND deleted_at IS NULL
ON CONFLICT DO NOTHING;

-- --------------------------------------------------------------------
-- Declared transitions.
--
-- Enforced in OpportunityService, not in a trigger: that is where the audit
-- context lives and where a refusal can say WHY in Spanish instead of raising
-- a constraint violation at the user.
-- --------------------------------------------------------------------

CREATE TABLE pipeline_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  -- NULL `from_stage` means "from anywhere": abandoning a deal is legal at any
  -- point, and enumerating six rows to say so would be noise.
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  -- The line the AI does not cross. Marking a deal won or lost is a commercial
  -- judgement with money attached; a person makes it.
  requires_human BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pipeline_id, from_stage, to_stage)
);

CREATE INDEX idx_pipeline_transitions_lookup
  ON pipeline_transitions (tenant_id, pipeline_id, from_stage);

-- Seed: the linear walk through each pipeline's own stage array, plus the two
-- moves people actually make -- skipping a stage forward, and going back one.
INSERT INTO pipeline_transitions (tenant_id, pipeline_id, from_stage, to_stage, requires_human)
SELECT p.tenant_id, p.id, p.stages[i], p.stages[j],
       -- The last stage of a pipeline is the close. Never automatic.
       (j = array_length(p.stages, 1))
FROM pipelines p,
     generate_subscripts(p.stages, 1) i,
     generate_subscripts(p.stages, 1) j
WHERE j > i          -- forward
   OR j = i - 1      -- one step back
ON CONFLICT DO NOTHING;

-- --------------------------------------------------------------------
-- After the handshake a deal stops being a pipeline and becomes a file.
--
-- The uncertainty changes shape: before, it is WHETHER it happens and the
-- broker controls most of it; after, it is WHEN, and what blocks it is the
-- bank, the notary, the conservador. Follow-up does not move it. Paperwork does.
-- --------------------------------------------------------------------

CREATE TABLE checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  -- venta, arriendo, … Free text for the same reason roles are.
  operation_kind TEXT NOT NULL DEFAULT 'venta',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE checklist_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
  position INT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  -- A blocking item stops the close. That distinction is the point of the list.
  blocking BOOLEAN NOT NULL DEFAULT false,
  owner_role TEXT,
  due_offset_days INT,
  document_kind TEXT,
  UNIQUE (template_id, position)
);

CREATE TABLE opportunity_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  template_id UUID REFERENCES checklist_templates(id) ON DELETE SET NULL,
  instantiated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (opportunity_id)
);

CREATE TABLE opportunity_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  checklist_id UUID NOT NULL REFERENCES opportunity_checklists(id) ON DELETE CASCADE,
  position INT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'done', 'blocked', 'na')),
  blocking BOOLEAN NOT NULL DEFAULT false,
  assignee_user UUID REFERENCES auth.users(id),
  due_at TIMESTAMPTZ,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_opportunity_checklist_items_list
  ON opportunity_checklist_items (tenant_id, checklist_id, position);

-- A document can now belong to a deal, which is where the promesa, the
-- tasación and the certificado de dominio actually live.
ALTER TYPE assignment_target ADD VALUE IF NOT EXISTS 'OPPORTUNITY';

ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS agreed_at TIMESTAMPTZ;
COMMENT ON COLUMN opportunities.agreed_at IS
  'When the deal crossed into the expediente. Set by the service on the transition, not by hand.';

-- --------------------------------------------------------------------
-- RLS
-- --------------------------------------------------------------------

ALTER TABLE opportunity_properties        ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_transitions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_templates           ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_template_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_checklists        ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_checklist_items   ENABLE ROW LEVEL SECURITY;

CREATE POLICY opportunity_properties_tenant ON opportunity_properties FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id()) WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY pipeline_transitions_tenant ON pipeline_transitions FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id()) WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY checklist_templates_tenant ON checklist_templates FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id()) WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY checklist_template_items_tenant ON checklist_template_items FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id()) WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY opportunity_checklists_tenant ON opportunity_checklists FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id()) WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY opportunity_checklist_items_tenant ON opportunity_checklist_items FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id()) WITH CHECK (tenant_id = public.get_my_tenant_id());

SELECT public.attach_audit('opportunity_properties');
SELECT public.attach_audit('opportunity_checklist_items');
