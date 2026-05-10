-- =====================================================================
-- Profiles: Chilean name structure
--
-- Replaces single full_name TEXT with structured name parts to support
-- Chilean naming convention (first_name + optional middle_name +
-- paternal_surname + maternal_surname). full_name becomes a generated
-- column so existing reads keep working without code churn.
-- =====================================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS first_name        TEXT,
  ADD COLUMN IF NOT EXISTS middle_name       TEXT,
  ADD COLUMN IF NOT EXISTS paternal_surname  TEXT,
  ADD COLUMN IF NOT EXISTS maternal_surname  TEXT;

-- Best-effort backfill: split current full_name by spaces.
-- Position 1 = first_name, 2 = middle_name, 3 = paternal, 4 = maternal.
-- Existing dev DB has no real users yet (post-cleanup baseline) so this
-- is mostly a no-op, but kept for safety.
UPDATE profiles
SET
  first_name        = NULLIF(split_part(full_name, ' ', 1), ''),
  middle_name       = NULLIF(split_part(full_name, ' ', 2), ''),
  paternal_surname  = NULLIF(split_part(full_name, ' ', 3), ''),
  maternal_surname  = NULLIF(split_part(full_name, ' ', 4), '')
WHERE full_name IS NOT NULL AND first_name IS NULL;

-- Drop existing full_name and recreate as generated column.
ALTER TABLE profiles DROP COLUMN IF EXISTS full_name;

-- Generated column must be IMMUTABLE. Only `||` and COALESCE are safe;
-- concat_ws / array_to_string / regexp_replace are all STABLE in PG and
-- rejected. We prepend a space inside each COALESCE so a NULL field
-- contributes nothing — then ltrim the leading space if first_name is null.
ALTER TABLE profiles ADD COLUMN full_name TEXT
  GENERATED ALWAYS AS (
    NULLIF(
      ltrim(
        COALESCE(first_name, '') ||
        COALESCE(' ' || middle_name,      '') ||
        COALESCE(' ' || paternal_surname, '') ||
        COALESCE(' ' || maternal_surname, '')
      ),
      ''
    )
  ) STORED;

-- Chilean RUT format check (shape only; dv mod-11 validated at app layer).
-- Format: 7-8 digits + dash + check digit (0-9 or K).
-- NOT VALID: skip existing rows (some have legacy formats); enforced going forward.
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS rut_format_chk;
ALTER TABLE profiles
  ADD CONSTRAINT rut_format_chk
  CHECK (rut IS NULL OR rut ~ '^[0-9]{7,8}-[0-9Kk]$') NOT VALID;

COMMENT ON COLUMN profiles.first_name        IS 'Primer nombre.';
COMMENT ON COLUMN profiles.middle_name       IS 'Segundo nombre (opcional).';
COMMENT ON COLUMN profiles.paternal_surname  IS 'Apellido paterno.';
COMMENT ON COLUMN profiles.maternal_surname  IS 'Apellido materno (opcional).';
COMMENT ON COLUMN profiles.full_name         IS 'Generated: concat of name parts, single-spaced.';
COMMENT ON COLUMN profiles.rut               IS 'Chilean RUT, format NNNNNNNN-D (dv 0-9 or K). dv validated at app layer.';
