-- =====================================================================
-- tenants.settings: AI assistant name + default paper size
-- =====================================================================
-- Centralized tenant-scoped configuration. Frontend reads settings on
-- boot via /tenants/me; backend may also consume.
-- =====================================================================

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::JSONB;

UPDATE tenants
SET settings = settings
  || jsonb_build_object(
       'ai_assistant_name', COALESCE(settings->>'ai_assistant_name', 'Anita'),
       'default_paper_size', COALESCE(settings->>'default_paper_size', 'A4')
     );
