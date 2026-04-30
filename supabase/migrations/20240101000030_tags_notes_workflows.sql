-- =====================================================================
-- Tags + polymorphic taggings, free-form notes, workflows + steps.
-- =====================================================================

-- ---------------------------------------------------------------------
-- tags
-- ---------------------------------------------------------------------
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);
CREATE INDEX idx_tags_tenant ON tags(tenant_id);

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY tags_tenant_select ON tags FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY tags_tenant_insert ON tags FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY tags_tenant_update ON tags FOR UPDATE TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY tags_tenant_delete ON tags FOR DELETE TO authenticated
  USING (tenant_id = public.get_my_tenant_id());


-- ---------------------------------------------------------------------
-- taggings (polymorphic via target_table + target_row_id; soft FK)
-- ---------------------------------------------------------------------
CREATE TABLE taggings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  target_table TEXT NOT NULL,
  target_row_id UUID NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tag_id, target_table, target_row_id)
);
CREATE INDEX idx_taggings_target ON taggings(target_table, target_row_id);
CREATE INDEX idx_taggings_tenant ON taggings(tenant_id);
CREATE INDEX idx_taggings_tag ON taggings(tag_id);

ALTER TABLE taggings ENABLE ROW LEVEL SECURITY;
CREATE POLICY taggings_tenant_select ON taggings FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY taggings_tenant_insert ON taggings FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY taggings_tenant_delete ON taggings FOR DELETE TO authenticated
  USING (tenant_id = public.get_my_tenant_id());


-- ---------------------------------------------------------------------
-- notes (polymorphic free-form notes attachable to any entity)
-- ---------------------------------------------------------------------
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  target_table TEXT,
  target_row_id UUID,
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'anita', 'import')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_notes_target ON notes(target_table, target_row_id);
CREATE INDEX idx_notes_tenant ON notes(tenant_id, created_at DESC) WHERE deleted_at IS NULL;

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY notes_tenant_select ON notes FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY notes_tenant_insert ON notes FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY notes_tenant_update ON notes FOR UPDATE TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY notes_tenant_delete ON notes FOR DELETE TO authenticated
  USING (tenant_id = public.get_my_tenant_id());

CREATE TRIGGER trg_notes_touch BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
SELECT public.attach_audit('notes');


-- ---------------------------------------------------------------------
-- workflows + workflow_steps (closing checklist, etc — polymorphic scope)
-- ---------------------------------------------------------------------
CREATE TYPE workflow_status AS ENUM (
  'NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED', 'CANCELLED'
);

CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  scope_table TEXT,
  scope_row_id UUID,
  state workflow_status NOT NULL DEFAULT 'NOT_STARTED',
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_workflows_tenant ON workflows(tenant_id, state) WHERE deleted_at IS NULL;
CREATE INDEX idx_workflows_scope ON workflows(scope_table, scope_row_id);

ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
CREATE POLICY workflows_tenant_select ON workflows FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY workflows_tenant_insert ON workflows FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY workflows_tenant_update ON workflows FOR UPDATE TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY workflows_tenant_delete ON workflows FOR DELETE TO authenticated
  USING (tenant_id = public.get_my_tenant_id());

CREATE TRIGGER trg_workflows_touch BEFORE UPDATE ON workflows
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
SELECT public.attach_audit('workflows');


CREATE TABLE workflow_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  status workflow_status NOT NULL DEFAULT 'NOT_STARTED',
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_wsteps_workflow ON workflow_steps(workflow_id, position);
CREATE INDEX idx_wsteps_tenant ON workflow_steps(tenant_id);

ALTER TABLE workflow_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY wsteps_tenant_select ON workflow_steps FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY wsteps_tenant_insert ON workflow_steps FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY wsteps_tenant_update ON workflow_steps FOR UPDATE TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY wsteps_tenant_delete ON workflow_steps FOR DELETE TO authenticated
  USING (tenant_id = public.get_my_tenant_id());

CREATE TRIGGER trg_wsteps_touch BEFORE UPDATE ON workflow_steps
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
