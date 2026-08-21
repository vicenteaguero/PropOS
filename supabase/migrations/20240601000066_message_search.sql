-- =====================================================================
-- Searching a message the way the rest of search already works.
--
-- Every other searchable table got an `immutable_unaccent` generated column in
-- 20240601000057, because half of Chilean place and person names carry an
-- accent and typing "nunoa" has to find "Ñuñoa". Message search shipped
-- against the raw column, so "credito" found nothing while "crédito" found
-- twenty — and nothing tells the user which of the two they typed. An empty
-- result reads as "that conversation does not exist".
-- =====================================================================

ALTER TABLE client_messages
  ADD COLUMN IF NOT EXISTS content_search TEXT
  GENERATED ALWAYS AS (public.immutable_unaccent(content)) STORED;

-- Trigram, not btree: this is always a `%needle%` match, which a btree index
-- cannot serve.
CREATE INDEX IF NOT EXISTS idx_client_messages_content_search
  ON client_messages USING gin (content_search gin_trgm_ops);

ALTER TABLE email_messages
  ADD COLUMN IF NOT EXISTS subject_search TEXT
  GENERATED ALWAYS AS (public.immutable_unaccent(subject)) STORED,
  ADD COLUMN IF NOT EXISTS body_search TEXT
  GENERATED ALWAYS AS (public.immutable_unaccent(body_text)) STORED;

CREATE INDEX IF NOT EXISTS idx_email_messages_subject_search
  ON email_messages USING gin (subject_search gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_email_messages_body_search
  ON email_messages USING gin (body_search gin_trgm_ops);
