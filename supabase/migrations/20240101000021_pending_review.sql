-- =====================================================================
-- pending_proposals: Anita's staging area for AI-proposed mutations
-- =====================================================================
-- Every Anita tool that mutates data writes to pending_proposals
-- (status='pending'); the user reviews and accepts/rejects via
-- /api/v1/pending. Accept handler runs the target service in a
-- transaction with SET LOCAL app.anita_session_id so audit_log stamps
-- source='anita'.
-- =====================================================================

CREATE TABLE pending_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  anita_session_id UUID NOT NULL,
  proposed_by_user UUID NOT NULL REFERENCES auth.users(id),

  -- Tool name that produced this proposal (e.g. 'propose_log_transaction')
  kind TEXT NOT NULL,

  -- Target entity (nullable for create operations until accepted)
  target_table TEXT,
  target_row_id UUID,

  -- Raw tool-call payload from the model
  payload JSONB NOT NULL,
  -- Payload after FK resolution / locale normalization (the executor's view)
  resolved_payload JSONB,
  -- Disambiguation candidates the executor flagged (e.g. multiple "Juan")
  ambiguity JSONB,

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'superseded', 'expired')),
  confidence NUMERIC(3, 2),

  -- Pointer to the assistant message that produced this proposal (for traceability)
  message_id UUID,

  reviewer_user UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,

  -- If accepted, the row that was actually created/modified
  created_row_id UUID,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pending_tenant_status ON pending_proposals(tenant_id, status, created_at DESC);
CREATE INDEX idx_pending_session ON pending_proposals(anita_session_id, created_at DESC);
CREATE INDEX idx_pending_kind ON pending_proposals(tenant_id, kind, status);

ALTER TABLE pending_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY pending_tenant_select ON pending_proposals FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY pending_tenant_insert ON pending_proposals FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY pending_tenant_update ON pending_proposals FOR UPDATE TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());

-- Only ADMIN may purge (delete) proposals; rejection flips status, doesn't delete
CREATE POLICY pending_admin_delete ON pending_proposals FOR DELETE TO authenticated
  USING (
    tenant_id = public.get_my_tenant_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'ADMIN'
    )
  );

CREATE TRIGGER trg_pending_touch BEFORE UPDATE ON pending_proposals
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- pending_proposals itself is its own audit trail; no audit trigger.

-- Realtime publication (frontend subscribes for badge updates)
ALTER PUBLICATION supabase_realtime ADD TABLE pending_proposals;
