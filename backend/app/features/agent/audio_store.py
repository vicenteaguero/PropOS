"""Persist Propo voice notes so a transcript can be re-audited.

`POST /agent/transcripts` used to transcribe the upload and drop it: the row
in `agent_transcripts` always had `media_file_id = NULL`, so a mis-heard
amount or address could never be checked against what the broker actually
said, nor reprocessed with a better model.

Storage failures are logged and swallowed — the transcript is still worth
returning without its audio.
"""

from __future__ import annotations

from uuid import UUID, uuid4

from app.core.logging.logger import get_logger
from app.core.supabase.client import get_supabase_client

logger = get_logger("AGENT_AUDIO")

BUCKET = "media"
PREFIX = "agent-audio"

# `media_files.type` and `.source` are CHECK-constrained to these vocabularies.
MEDIA_TYPE_AUDIO = "audio"
MEDIA_SOURCE_RECORDER = "recorder"

_EXT_BY_MIME = {
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/x-m4a": "m4a",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
}


def _extension(filename: str | None, mime: str | None) -> str:
    if mime:
        base = mime.split(";", 1)[0].strip().lower()
        if base in _EXT_BY_MIME:
            return _EXT_BY_MIME[base]
    if filename and "." in filename:
        ext = filename.rsplit(".", 1)[-1].lower()
        if ext.isalnum() and len(ext) <= 5:
            return ext
    return "webm"


def store_voice_note(
    data: bytes,
    *,
    tenant_id: UUID,
    user_id: str,
    filename: str | None = None,
    mime: str | None = None,
) -> UUID | None:
    """Upload the blob and register it in `media_files`. None if it fails."""
    if not data:
        return None

    client = get_supabase_client()
    ext = _extension(filename, mime)
    path = f"{tenant_id}/{PREFIX}/{uuid4()}.{ext}"
    content_type = (mime or "").split(";", 1)[0].strip() or f"audio/{ext}"

    try:
        client.storage.from_(BUCKET).upload(
            path=path,
            file=data,
            file_options={"content-type": content_type, "upsert": "true"},
        )
        url = client.storage.from_(BUCKET).get_public_url(path)
        row = (
            client.table("media_files")
            .insert(
                {
                    "tenant_id": str(tenant_id),
                    "url": url,
                    "type": MEDIA_TYPE_AUDIO,
                    "source": MEDIA_SOURCE_RECORDER,
                    "kind": "AUDIO",
                    "uploaded_by": str(user_id),
                }
            )
            .execute()
            .data[0]
        )
    except Exception as exc:  # noqa: BLE001 - never fail a transcript over storage
        logger.warning("voice_note_persist_failed", event_type="storage", path=path, error=str(exc)[:200])
        return None

    logger.info("voice_note_persisted", event_type="storage", path=path, media_file_id=row["id"], bytes=len(data))
    return UUID(row["id"])
