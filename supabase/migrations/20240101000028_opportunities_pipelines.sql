-- =====================================================================
-- Pipelines (config) + Opportunities (deals) + stage history
-- =====================================================================

CREATE TYPE opportunity_status AS ENUM ('OPEN', 'WON', 'LOST');


-- ---------------------------------------------------------------------
-- pipelines (config: stages array, allows non-engineers to add stages)
-- ---------------------------------------------------------------------
CREATE TABLE pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  stages TEXT[] NOT NULL DEFAULT ARRAY['LEAD', 'QUALIFIED', 'VISIT', 'OFFER', 'RESERVATION', 'CLOSED']::TEXT[],
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);
CREATE INDEX idx_pipelines_tenant ON pipelines(tenant_id);

ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;
CREATE POLICY pipelines_tenant_select ON pipelines FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY pipelines_tenant_insert ON pipelines FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY pipelines_tenant_update ON pipelines FOR UPDATE TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY pipelines_tenant_delete ON pipelines FOR DELETE TO authenticated
  USING (tenant_id = public.get_my_tenant_id());


-- ---------------------------------------------------------------------
-- opportunities
-- ---------------------------------------------------------------------
CREATE TABLE opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pipeline_id UUID REFERENCES pipelines(id) ON DELETE SET NULL,
  person_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  pipeline_stage TEXT NOT NULL DEFAULT 'LEAD',
  status opportunity_status NOT NULL DEFAULT 'OPEN',
  expected_close_at DATE,
  expected_value_cents BIGINT,
  currency CHAR(3) NOT NULL DEFAULT 'CLP',
  probability SMALLINT CHECK (probability IS NULL OR (probability >= 0 AND probability <= 100)),
  lost_reason TEXT,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'anita', 'import')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_opportunities_tenant ON opportunities(tenant_id, status, pipeline_stage) WHERE deleted_at IS NULL;
CREATE INDEX idx_opportunities_person ON opportunities(person_id) WHERE person_id IS NOT NULL;
CREATE INDEX idx_opportunities_property ON opportunities(property_id) WHERE property_id IS NOT NULL;
CREATE INDEX idx_opportunities_close ON opportunities(tenant_id, expected_close_at) WHERE status = 'OPEN';

ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY opportunities_tenant_select ON opportunities FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY opportunities_tenant_insert ON opportunities FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY opportunities_tenant_update ON opportunities FOR UPDATE TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY opportunities_tenant_delete ON opportunities FOR DELETE TO authenticated
  USING (tenant_id = public.get_my_tenant_id());

CREATE TRIGGER trg_opportunities_touch BEFORE UPDATE ON opportunities
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
SELECT public.attach_audit('opportunities');


-- ---------------------------------------------------------------------
-- opportunity_stage_history
-- ---------------------------------------------------------------------
CREATE TABLE opportunity_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  note TEXT,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_opp_history_opp ON opportunity_stage_history(opportunity_id, changed_at DESC);
CREATE INDEX idx_opp_history_tenant ON opportunity_stage_history(tenant_id);

ALTER TABLE opportunity_stage_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY opp_history_tenant_select ON opportunity_stage_history FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY opp_history_tenant_insert ON opportunity_stage_history FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id());


CREATE OR REPLACE FUNCTION public.opportunity_stage_logger()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.pipeline_stage IS DISTINCT FROM NEW.pipeline_stage) THEN
    INSERT INTO opportunity_stage_history (
      tenant_id, opportunity_id, from_stage, to_stage, changed_by
    ) VALUES (
      NEW.tenant_id, NEW.id, OLD.pipeline_stage, NEW.pipeline_stage, auth.uid()
    );
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO opportunity_stage_history (
      tenant_id, opportunity_id, from_stage, to_stage, changed_by
    ) VALUES (
      NEW.tenant_id, NEW.id, NULL, NEW.pipeline_stage, auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_opp_stage_log AFTER INSERT OR UPDATE ON opportunities
  FOR EACH ROW EXECUTE FUNCTION public.opportunity_stage_logger();


-- ---------------------------------------------------------------------
-- back-fill: interaction_targets.opportunity_id (FK now resolvable)
-- ---------------------------------------------------------------------
ALTER TABLE interaction_targets
  ADD COLUMN IF NOT EXISTS opportunity_id UUID REFERENCES opportunities(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_itargets_opportunity ON interaction_targets(opportunity_id) WHERE opportunity_id IS NOT NULL;
