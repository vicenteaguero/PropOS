-- =====================================================================
-- Compliance minimal — Ley N° 21.719 (Chile)
-- =====================================================================
-- v3 minimal plan. No new tables. Adds consent state to contacts (jsonb),
-- a per-row purge timestamp on media_files, and privacy policy metadata
-- on tenants. Inherits RLS from existing policies on each parent table.
-- =====================================================================

-- ---------------------------------------------------------------------
-- contacts.consent — Art. 12 Ley 21.719
-- ---------------------------------------------------------------------
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS consent JSONB DEFAULT NULL;

COMMENT ON COLUMN contacts.consent IS
  'Ley 21.719 Art. 12 consent state. Null = no consent recorded. '
  'Shape: {"version":"1.0","granted_at":"...","purposes":["operacional","marketing",...],'
  '"evidence":{"ip":"...","ua":"...","text_shown":"..."},"revoked_at":null,'
  '"blocked_at":null}';


-- ---------------------------------------------------------------------
-- media_files.purge_after — Art. 14 quinquies (minimización + retención)
-- ---------------------------------------------------------------------
ALTER TABLE media_files
  ADD COLUMN IF NOT EXISTS purge_after TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS media_files_purge_after_idx
  ON media_files(purge_after) WHERE purge_after IS NOT NULL;

COMMENT ON COLUMN media_files.purge_after IS
  'Ley 21.719 Art. 14 quinquies. Scheduled hard-delete date. '
  'NULL = no scheduled purge. Manual purge job reads this column.';


-- ---------------------------------------------------------------------
-- tenants — privacy policy + DPO contact (Art. 14 obligación de informar)
-- ---------------------------------------------------------------------
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS privacy_policy_version TEXT NOT NULL DEFAULT '1.0';

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS privacy_contact_email TEXT;

COMMENT ON COLUMN tenants.privacy_policy_version IS
  'Versión de la política de privacidad publicada. '
  'Bump cuando cambie material el texto o las finalidades.';

COMMENT ON COLUMN tenants.privacy_contact_email IS
  'Punto de contacto público para solicitudes de derechos y privacidad.';
