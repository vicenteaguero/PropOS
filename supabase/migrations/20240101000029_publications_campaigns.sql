-- =====================================================================
-- Publications (property × portal listing) + Campaigns + Ads
-- =====================================================================

CREATE TYPE publication_status AS ENUM (
  'DRAFT', 'ACTIVE', 'PAUSED', 'EXPIRED', 'REMOVED'
);

CREATE TYPE campaign_channel AS ENUM (
  'META', 'GOOGLE', 'PORTAL', 'EMAIL', 'OFFLINE', 'OTHER'
);

CREATE TYPE campaign_status AS ENUM (
  'DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'
);


-- ---------------------------------------------------------------------
-- publications
-- ---------------------------------------------------------------------
CREATE TABLE publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  portal_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  external_url TEXT,
  external_id TEXT,
  status publication_status NOT NULL DEFAULT 'DRAFT',
  listed_at TIMESTAMPTZ,
  removed_at TIMESTAMPTZ,
  view_count_external INT NOT NULL DEFAULT 0,
  inquiries_count INT NOT NULL DEFAULT 0,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'anita', 'import')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_publications_tenant ON publications(tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_publications_property ON publications(property_id);
CREATE INDEX idx_publications_portal ON publications(portal_org_id);

ALTER TABLE publications ENABLE ROW LEVEL SECURITY;
CREATE POLICY publications_tenant_select ON publications FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY publications_tenant_insert ON publications FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY publications_tenant_update ON publications FOR UPDATE TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY publications_tenant_delete ON publications FOR DELETE TO authenticated
  USING (tenant_id = public.get_my_tenant_id());

CREATE TRIGGER trg_publications_touch BEFORE UPDATE ON publications
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
SELECT public.attach_audit('publications');


-- ---------------------------------------------------------------------
-- campaigns
-- ---------------------------------------------------------------------
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  channel campaign_channel NOT NULL,
  status campaign_status NOT NULL DEFAULT 'DRAFT',
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  budget_cents BIGINT,
  currency CHAR(3) NOT NULL DEFAULT 'CLP',
  external_id TEXT,
  -- Soft-FK list of related properties/projects via JSONB for flexibility
  related JSONB NOT NULL DEFAULT '{}'::JSONB,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'anita', 'import')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_campaigns_tenant ON campaigns(tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_campaigns_channel ON campaigns(tenant_id, channel);
CREATE INDEX idx_campaigns_name_trgm ON campaigns USING gin (name gin_trgm_ops);

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY campaigns_tenant_select ON campaigns FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY campaigns_tenant_insert ON campaigns FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY campaigns_tenant_update ON campaigns FOR UPDATE TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY campaigns_tenant_delete ON campaigns FOR DELETE TO authenticated
  USING (tenant_id = public.get_my_tenant_id());

CREATE TRIGGER trg_campaigns_touch BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
SELECT public.attach_audit('campaigns');


-- ---------------------------------------------------------------------
-- ads (individual creatives within a campaign)
-- ---------------------------------------------------------------------
CREATE TABLE ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  external_id TEXT,
  spend_cents BIGINT NOT NULL DEFAULT 0,
  impressions INT NOT NULL DEFAULT 0,
  clicks INT NOT NULL DEFAULT 0,
  leads_count INT NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_ads_campaign ON ads(campaign_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_ads_tenant ON ads(tenant_id);

ALTER TABLE ads ENABLE ROW LEVEL SECURITY;
CREATE POLICY ads_tenant_select ON ads FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY ads_tenant_insert ON ads FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY ads_tenant_update ON ads FOR UPDATE TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY ads_tenant_delete ON ads FOR DELETE TO authenticated
  USING (tenant_id = public.get_my_tenant_id());

CREATE TRIGGER trg_ads_touch BEFORE UPDATE ON ads
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


-- ---------------------------------------------------------------------
-- back-fill: transactions.related_campaign_id
-- ---------------------------------------------------------------------
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS related_campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_campaign ON transactions(related_campaign_id) WHERE related_campaign_id IS NOT NULL;
