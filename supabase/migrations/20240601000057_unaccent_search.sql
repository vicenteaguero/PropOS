-- =====================================================================
-- Accent-insensitive search.
--
-- A broker types "rocio" and expects "Rocío Vergara". Chilean names,
-- comunas and street names are full of accents, so an `ilike '%rocio%'`
-- against the raw column silently finds nothing and the picker looks empty
-- rather than wrong — the worst kind of failure, because it teaches the
-- user the record does not exist.
--
-- Generated columns rather than an RPC: the search service talks to
-- PostgREST, which can filter on a column but cannot call a function with
-- arguments through the normal query interface. The column is STORED, so
-- the cost is paid once on write instead of on every keystroke.
--
-- `unaccent()` is STABLE, not IMMUTABLE (its dictionary can be reloaded),
-- and a generated column requires IMMUTABLE. The wrapper below is the
-- standard workaround: it pins the dictionary explicitly, which makes the
-- result genuinely deterministic for a fixed install.
-- =====================================================================

-- unaccent joins pgcrypto/uuid-ossp in `extensions`, the schema Supabase keeps
-- them in. pg_trgm is NOT created here: this project already has it installed
-- in `public`, which is why the operator class below is public-qualified.
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.immutable_unaccent(text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  PARALLEL SAFE
  STRICT
  SET search_path = extensions, public
AS $$ SELECT lower(extensions.unaccent('extensions.unaccent', $1)) $$;

COMMENT ON FUNCTION public.immutable_unaccent(text) IS
  'Lowercased, accent-stripped text for search columns. IMMUTABLE so generated columns and indexes can use it.';

-- One generated column per searchable label, plus a trigram index so the
-- leading-wildcard LIKE these searches use can still be indexed.
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS full_name_search TEXT
  GENERATED ALWAYS AS (public.immutable_unaccent(full_name)) STORED;
CREATE INDEX IF NOT EXISTS idx_contacts_full_name_search
  ON contacts USING gin (full_name_search public.gin_trgm_ops);

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS title_search TEXT
  GENERATED ALWAYS AS (public.immutable_unaccent(title)) STORED;
CREATE INDEX IF NOT EXISTS idx_properties_title_search
  ON properties USING gin (title_search public.gin_trgm_ops);

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS address_search TEXT
  GENERATED ALWAYS AS (public.immutable_unaccent(address)) STORED;
CREATE INDEX IF NOT EXISTS idx_properties_address_search
  ON properties USING gin (address_search public.gin_trgm_ops);

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS title_search TEXT
  GENERATED ALWAYS AS (public.immutable_unaccent(title)) STORED;
CREATE INDEX IF NOT EXISTS idx_events_title_search
  ON events USING gin (title_search public.gin_trgm_ops);

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS name_search TEXT
  GENERATED ALWAYS AS (public.immutable_unaccent(name)) STORED;
CREATE INDEX IF NOT EXISTS idx_projects_name_search
  ON projects USING gin (name_search public.gin_trgm_ops);

ALTER TABLE places
  ADD COLUMN IF NOT EXISTS name_search TEXT
  GENERATED ALWAYS AS (public.immutable_unaccent(name)) STORED;
CREATE INDEX IF NOT EXISTS idx_places_name_search
  ON places USING gin (name_search public.gin_trgm_ops);
