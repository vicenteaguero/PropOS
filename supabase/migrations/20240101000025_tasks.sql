-- =====================================================================
-- Tasks: unified table for TODO, PENDING, GOAL, OBJECTIVE, PLAN.
-- parent_task_id supports goals → objectives → todos hierarchy.
-- related JSONB (GIN-indexed) holds soft-FK to properties/people/projects.
-- =====================================================================

CREATE TYPE task_kind AS ENUM (
  'TODO', 'PENDING', 'GOAL', 'OBJECTIVE', 'PLAN'
);

CREATE TYPE task_status AS ENUM (
  'OPEN', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED'
);


CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  kind task_kind NOT NULL DEFAULT 'TODO',
  title TEXT NOT NULL,
  description TEXT,
  status task_status NOT NULL DEFAULT 'OPEN',
  priority SMALLINT NOT NULL DEFAULT 0,
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  parent_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  owner_user UUID REFERENCES auth.users(id),
  -- Soft-FK structure: {properties:[uuid,...], people:[...], projects:[...],
  -- opportunities:[...], campaigns:[...], organizations:[...]}
  related JSONB NOT NULL DEFAULT '{}'::JSONB,
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'anita', 'import', 'system')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_tasks_tenant_open ON tasks(tenant_id, status, due_at NULLS LAST)
  WHERE deleted_at IS NULL AND status NOT IN ('DONE', 'CANCELLED');
CREATE INDEX idx_tasks_tenant_kind ON tasks(tenant_id, kind, status);
CREATE INDEX idx_tasks_owner ON tasks(owner_user, status) WHERE owner_user IS NOT NULL;
CREATE INDEX idx_tasks_related_gin ON tasks USING gin (related jsonb_path_ops);
CREATE INDEX idx_tasks_parent ON tasks(parent_task_id) WHERE parent_task_id IS NOT NULL;

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY tasks_tenant_select ON tasks FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY tasks_tenant_insert ON tasks FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY tasks_tenant_update ON tasks FOR UPDATE TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY tasks_tenant_delete ON tasks FOR DELETE TO authenticated
  USING (tenant_id = public.get_my_tenant_id());

CREATE TRIGGER trg_tasks_touch BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
SELECT public.attach_audit('tasks');
