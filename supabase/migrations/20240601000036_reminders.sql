-- =====================================================================
-- reminders: polymorphic, delivered by the run-due-reminders cron job.
-- One pipeline for events, tasks and (P6) payment due-dates.
-- =====================================================================

CREATE TYPE reminder_status AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED', 'CANCELLED');

CREATE TABLE reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  target_table TEXT NOT NULL CHECK (target_table IN ('events', 'tasks', 'transactions')),
  target_row_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  remind_at TIMESTAMPTZ NOT NULL,
  channel TEXT NOT NULL DEFAULT 'push' CHECK (channel IN ('push', 'whatsapp')),
  message TEXT,
  url TEXT,
  status reminder_status NOT NULL DEFAULT 'PENDING',
  sent_at TIMESTAMPTZ,
  error TEXT,
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'agent', 'import', 'system')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Hot path for the cron claim query.
CREATE INDEX idx_reminders_due ON reminders(remind_at)
  WHERE status = 'PENDING' AND deleted_at IS NULL;
CREATE INDEX idx_reminders_target ON reminders(target_table, target_row_id);
CREATE INDEX idx_reminders_tenant ON reminders(tenant_id, remind_at DESC) WHERE deleted_at IS NULL;

ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY reminders_tenant_select ON reminders FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY reminders_tenant_insert ON reminders FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY reminders_tenant_update ON reminders FOR UPDATE TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY reminders_tenant_delete ON reminders FOR DELETE TO authenticated
  USING (tenant_id = public.get_my_tenant_id());

CREATE TRIGGER trg_reminders_touch BEFORE UPDATE ON reminders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
SELECT public.attach_audit('reminders');
