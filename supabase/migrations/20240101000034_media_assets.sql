-- =====================================================================
-- media_assets: polymorphic links from media_files (fotos/videos/planos)
-- to any domain entity. Already-uploaded media_files (audio mostly until
-- now) gain typed associations.
-- =====================================================================

CREATE TYPE media_kind AS ENUM (
  'PHOTO', 'VIDEO', 'PLAN', 'AUDIO', 'DOCUMENT', 'OTHER'
);


-- ---------------------------------------------------------------------
-- Extend media_files with kind classification
-- ---------------------------------------------------------------------
ALTER TABLE media_files
  ADD COLUMN IF NOT EXISTS kind media_kind,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

UPDATE media_files SET kind = CASE
  WHEN type = 'photo' THEN 'PHOTO'::media_kind
  WHEN type = 'audio' THEN 'AUDIO'::media_kind
  ELSE 'OTHER'::media_kind
END
WHERE kind IS NULL;


-- ---------------------------------------------------------------------
-- media_assets (polymorphic linking)
-- ---------------------------------------------------------------------
CREATE TABLE media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  media_file_id UUID NOT NULL REFERENCES media_files(id) ON DELETE CASCADE,
  target_table TEXT NOT NULL,
  target_row_id UUID NOT NULL,
  role TEXT,
  position INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (media_file_id, target_table, target_row_id)
);
CREATE INDEX idx_media_assets_target ON media_assets(target_table, target_row_id);
CREATE INDEX idx_media_assets_media ON media_assets(media_file_id);
CREATE INDEX idx_media_assets_tenant ON media_assets(tenant_id);

ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY media_assets_tenant_select ON media_assets FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY media_assets_tenant_insert ON media_assets FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY media_assets_tenant_update ON media_assets FOR UPDATE TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY media_assets_tenant_delete ON media_assets FOR DELETE TO authenticated
  USING (tenant_id = public.get_my_tenant_id());

SELECT public.attach_audit('media_assets');
