-- Multimodal inbound for Anita-over-WhatsApp: audio (transcription) + images
-- (unprocessed buffer consumed by follow-up text). Forwarded marker passes
-- through from Kapso/Meta payload.
ALTER TABLE public.anita_messages
  ADD COLUMN IF NOT EXISTS media_url TEXT,
  ADD COLUMN IF NOT EXISTS media_mime TEXT,
  ADD COLUMN IF NOT EXISTS media_kapso_id TEXT,
  ADD COLUMN IF NOT EXISTS transcription TEXT,
  ADD COLUMN IF NOT EXISTS is_forwarded BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS media_status TEXT;
  -- media_status ∈ {NULL, 'unprocessed', 'consumed', 'failed'}.
  -- NULL = not a media row. 'unprocessed' = waiting for follow-up text intent.

-- Hot path: dispatcher queries unprocessed media for the active session.
CREATE INDEX IF NOT EXISTS anita_messages_unprocessed_media_idx
  ON public.anita_messages (session_id, created_at DESC)
  WHERE media_status = 'unprocessed';
