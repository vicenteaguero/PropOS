-- =====================================================================
-- notes: priority, pinned, colour
--
-- A note could only be created, read and deleted. There was no way to say one
-- mattered more than another, to keep one at the top, or to keep the colour it
-- was given — the tint was picked in the client from the note's index in the
-- list, so re-ordering the list silently repainted every card.
-- =====================================================================

ALTER TABLE notes
  ADD COLUMN IF NOT EXISTS priority SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS color TEXT;

-- Pinned notes are a handful per tenant; a partial index is the whole query.
CREATE INDEX IF NOT EXISTS idx_notes_pinned
  ON notes(tenant_id)
  WHERE pinned = TRUE AND deleted_at IS NULL;
