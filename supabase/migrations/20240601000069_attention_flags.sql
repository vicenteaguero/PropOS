-- "Watch this one." A temporary, shared mark on a person or a property.
--
-- The attention queue ranks by rules — the WhatsApp window, a visit's hour, a
-- task's due date — and those rules are right on average and blind to what the
-- broker knows. A deal about to fall over, a client who called the office
-- angry: none of that is in a timestamp. There was no way at all to say "this
-- one, for the next two days", which is the whole point of a queue you trust.
--
-- Shared across the workspace and attributed, per the owner: everyone sees the
-- mark, it says whose it is, and anyone can take it, extend it or clear it.
-- `created_by` is authorship, not ownership — deliberately no `user_id`.
--
-- Expiry is a column, not a job: a flag that has to be swept is a flag that is
-- sometimes wrong. Every read filters on `expires_at > now()`.

CREATE TABLE IF NOT EXISTS attention_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  target_kind TEXT NOT NULL CHECK (target_kind IN ('CONTACT', 'PROPERTY')),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  note TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,

  -- Typed exclusive arc, the same shape as note_targets and interaction_targets.
  CONSTRAINT attention_flags_target_arc CHECK (
    (target_kind = 'CONTACT' AND contact_id IS NOT NULL AND property_id IS NULL)
    OR (target_kind = 'PROPERTY' AND property_id IS NOT NULL AND contact_id IS NULL)
  )
);

-- One live flag per target. Partial, so an expired flag does not block a new
-- one — re-flagging something two days later is the normal case, not a clash.
CREATE UNIQUE INDEX IF NOT EXISTS idx_attention_flags_contact_live
  ON attention_flags (tenant_id, contact_id)
  WHERE contact_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_attention_flags_property_live
  ON attention_flags (tenant_id, property_id)
  WHERE property_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_attention_flags_live
  ON attention_flags (tenant_id, expires_at DESC);

ALTER TABLE attention_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY attention_flags_tenant_select ON attention_flags FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY attention_flags_tenant_insert ON attention_flags FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY attention_flags_tenant_update ON attention_flags FOR UPDATE TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY attention_flags_tenant_delete ON attention_flags FOR DELETE TO authenticated
  USING (tenant_id = public.get_my_tenant_id());
