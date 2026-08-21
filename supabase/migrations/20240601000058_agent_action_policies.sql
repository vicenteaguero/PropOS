-- =====================================================================
-- agent_action_policies: what Propo may do on its own, per tenant.
--
-- Until now autonomy was a compile-time constant. `IntentSpec.auto_commit`
-- defaults to True on a frozen dataclass (agent/intent_registry.py:37), and
-- only 2 of the 12 intents opt out -- so ten kinds of write, including
-- creating and editing people, went straight into the CRM with no human ever
-- seeing them. `pending_proposals` was not the path: `dispatcher.py` falls back
-- to it only when the direct write RAISES.
--
-- Three levels, because "on/off" cannot express the real rule:
--   observe  -- read and log, never write, never queue. For a tenant that wants
--               Propo watching before it touches anything.
--   suggest  -- write a pending_proposal and stop. A human accepts.
--   execute  -- write the domain row directly, attributed to the agent.
--
-- No row means the code default for that action (agent/policies.py), which is
-- tiered by risk: reversible and internal executes, anything touching a person,
-- a deal, money, or the outside world suggests. A row here overrides it, so a
-- brokerage can loosen or tighten without a deploy.
-- =====================================================================

CREATE TABLE agent_action_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- Matches IntentSpec.name. Deliberately TEXT and not an enum: the intent
  -- registry gains entries in code, and a vocabulary that needs a migration to
  -- follow it would be permanently one release behind.
  action_kind TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('observe', 'suggest', 'execute')),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, action_kind)
);

CREATE INDEX idx_agent_action_policies_tenant ON agent_action_policies (tenant_id);

ALTER TABLE agent_action_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY agent_action_policies_select ON agent_action_policies
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());

-- Only an admin changes what the AI may do unattended.
CREATE POLICY agent_action_policies_write ON agent_action_policies
  FOR ALL TO authenticated
  USING (
    tenant_id = public.get_my_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'ADMIN'
    )
  )
  WITH CHECK (
    tenant_id = public.get_my_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'ADMIN'
    )
  );

SELECT public.attach_audit('agent_action_policies');

-- =====================================================================
-- Evidence on proposals.
--
-- `pending_proposals` already declares `message_id`, `confidence` and
-- `ambiguity`, and the live path writes NONE of them (dispatcher.py calls
-- _create_proposal with ambiguity=None and never sets message_id). A reviewer
-- was shown a payload with no way to see what the client actually said.
--
-- `evidence` carries the quote and where it came from:
--   {"quote": "...", "source": "whatsapp"|"email"|"voice"|"chat",
--    "conversation_id": uuid, "client_message_id": uuid, "transcript_id": uuid}
-- =====================================================================

ALTER TABLE pending_proposals
  ADD COLUMN IF NOT EXISTS evidence JSONB;

-- A rejection is the cheapest training signal there is, and free-text alone
-- cannot be counted. The taxonomy is small on purpose; `review_note` keeps the
-- detail.
ALTER TABLE pending_proposals
  ADD COLUMN IF NOT EXISTS review_reason TEXT
  CHECK (review_reason IS NULL OR review_reason IN (
    'dato_incorrecto', 'entidad_equivocada', 'no_corresponde', 'duplicado', 'otro'
  ));

COMMENT ON COLUMN pending_proposals.evidence IS
  'What the human said that produced this proposal: quote, channel and source row ids.';
COMMENT ON COLUMN pending_proposals.review_reason IS
  'Why a proposal was rejected, from a fixed taxonomy. Free detail goes in review_note.';
