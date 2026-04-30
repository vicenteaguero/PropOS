-- =====================================================================
-- Transactions: ledger for gastos, costos, boletas, ad spend, ingresos.
-- amount_cents BIGINT (avoids float drift). Default currency CLP.
-- receipt_document_id links to documents (la boleta).
-- =====================================================================

CREATE TYPE transaction_direction AS ENUM ('IN', 'OUT');

CREATE TYPE transaction_category AS ENUM (
  'AD_SPEND', 'COMMISSION', 'RENT', 'UTILITY', 'SALARY',
  'NOTARY_FEE', 'MARKETING', 'SOFTWARE', 'TAX', 'REIMBURSEMENT',
  'SALE_PROCEEDS', 'DEPOSIT', 'REFUND', 'TRANSFER', 'OTHER'
);


CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  direction transaction_direction NOT NULL,
  category transaction_category NOT NULL DEFAULT 'OTHER',
  amount_cents BIGINT NOT NULL CHECK (amount_cents >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'CLP',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  description TEXT,
  vendor_org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  payer_person_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  related_property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  -- related_project_id and related_campaign_id added in later migrations
  receipt_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'anita', 'import')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_transactions_tenant ON transactions(tenant_id, occurred_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_transactions_category ON transactions(tenant_id, category, occurred_at DESC);
CREATE INDEX idx_transactions_direction ON transactions(tenant_id, direction, occurred_at DESC);
CREATE INDEX idx_transactions_property ON transactions(related_property_id) WHERE related_property_id IS NOT NULL;

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY transactions_tenant_select ON transactions FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY transactions_tenant_insert ON transactions FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY transactions_tenant_update ON transactions FOR UPDATE TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY transactions_tenant_delete ON transactions FOR DELETE TO authenticated
  USING (tenant_id = public.get_my_tenant_id());

CREATE TRIGGER trg_transactions_touch BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
SELECT public.attach_audit('transactions');
