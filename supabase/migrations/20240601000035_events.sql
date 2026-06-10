-- =====================================================================
-- events: calendar entries (visits, meetings, deadlines).
-- Explicit nullable FKs (property/contact/project) match the agent resolver
-- lanes and give cheap joins for per-entity tabs + the calendar feed.
-- No recurrence in v0.1.0.
-- =====================================================================

CREATE TYPE event_kind AS ENUM ('VISIT', 'MEETING', 'CALL', 'DEADLINE', 'OTHER');
CREATE TYPE event_status AS ENUM ('SCHEDULED', 'DONE', 'CANCELLED');

CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  kind event_kind NOT NULL DEFAULT 'OTHER',
  title TEXT NOT NULL,
  description TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  all_day BOOLEAN NOT NULL DEFAULT FALSE,
  location TEXT,
  status event_status NOT NULL DEFAULT 'SCHEDULED',
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  assignee_user UUID REFERENCES auth.users(id),
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'agent', 'import', 'system')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT events_end_after_start CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

CREATE INDEX idx_events_tenant_start ON events(tenant_id, starts_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_events_property ON events(property_id) WHERE property_id IS NOT NULL;
CREATE INDEX idx_events_contact ON events(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX idx_events_assignee ON events(assignee_user) WHERE assignee_user IS NOT NULL;

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY events_tenant_select ON events FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY events_tenant_insert ON events FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY events_tenant_update ON events FOR UPDATE TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY events_tenant_delete ON events FOR DELETE TO authenticated
  USING (tenant_id = public.get_my_tenant_id());

CREATE TRIGGER trg_events_touch BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
SELECT public.attach_audit('events');
