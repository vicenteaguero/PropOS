"""Note attachments: photos and voice memos, stored as `media_assets` rows.

`media_assets` is already polymorphic (`target_table`, `target_row_id`) and is
exactly what property photos use, so a note attachment needs no new table --
only `target_table='notes'`.

The storage/derivative primitives are imported from the property photo module
rather than copied. They are pure helpers over the `media` bucket (path
parsing, WebP renditions, batch signing) with nothing property-specific in
them, and a second copy would drift the moment either side changed.

Every URL in a response is freshly signed: the `media` bucket is private
(20240601000053).
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from app.core.logging.logger import get_logger
from app.features.properties.photos import (
    ALLOWED_IMAGE_MIME,
    MEDIA_BUCKET,
    derivative_path,
    ext_for,
    storage_path_from_url,
    upload_derivatives,
)
from app.features.properties.photos import (
    sign_many as sign_paths,
)
from app.core.supabase.client import get_supabase_client

MEDIA_ASSETS = "media_assets"
MEDIA_FILES = "media_files"
TARGET_TABLE = "notes"

# Both roles land in the same `media_assets` table; `role` is what separates a
# photo strip from a voice memo when rendering.
PHOTO_ROLE = "PHOTO"
AUDIO_ROLE = "AUDIO"

ALLOWED_AUDIO_MIME = {
    "audio/webm",
    "audio/mp4",
    "audio/mpeg",
    "audio/mp3",
    "audio/ogg",
    "audio/wav",
    "audio/x-m4a",
    "audio/aac",
}

_AUDIO_EXT = {
    "audio/webm": "webm",
    "audio/mp4": "m4a",
    "audio/x-m4a": "m4a",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/ogg": "ogg",
    "audio/wav": "wav",
    "audio/aac": "aac",
}

MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024
MAX_ATTACHMENTS_PER_REQUEST = 10

logger = get_logger("NOTE_ATTACHMENTS")


class UnsupportedAttachmentError(ValueError):
    """Mime type is neither an accepted image nor an accepted audio format."""


def role_for_mime(mime: str) -> str:
    normalized = (mime or "").lower().split(";")[0].strip()
    if normalized in ALLOWED_IMAGE_MIME:
        return PHOTO_ROLE
    if normalized in ALLOWED_AUDIO_MIME:
        return AUDIO_ROLE
    raise UnsupportedAttachmentError(mime or "unknown")


def _extension(mime: str, filename: str | None, role: str) -> str:
    if role == AUDIO_ROLE:
        return _AUDIO_EXT.get(mime.lower(), "webm")
    return ext_for(mime, filename)


def _build_rows(assets: list[dict], files_by_id: dict[str, dict], signed: dict[str, str]) -> list[dict]:
    """Join assets to their media files and to the already-signed URLs."""
    out: list[dict] = []
    for asset in assets:
        media = files_by_id.get(asset["media_file_id"])
        if media is None:
            continue
        stored = media.get("url")
        path = storage_path_from_url(stored)
        role = asset.get("role") or PHOTO_ROLE
        # External media (imported, never uploaded by us) has no object path and
        # is passed through verbatim.
        url = signed.get(path or "", stored or "") if path else (stored or "")
        thumb = card = None
        if path and role == PHOTO_ROLE:
            # A derivative that was never generated simply fails to sign, so the
            # original stands in — no existence check, no extra round trip.
            thumb = signed.get(derivative_path(path, "thumb")) or url
            card = signed.get(derivative_path(path, "card")) or url
        out.append(
            {
                "id": asset["id"],
                "note_id": asset["target_row_id"],
                "media_file_id": asset["media_file_id"],
                "role": role,
                "position": asset.get("position") or 0,
                "url": url,
                "thumb_url": thumb,
                "card_url": card,
                "title": media.get("title"),
                "created_at": asset.get("created_at"),
            }
        )
    return out


def list_for_notes(tenant_id: UUID, note_ids: list[str]) -> dict[str, list[dict]]:
    """Attachments for a page of notes, grouped by note id.

    Three round trips for the whole page regardless of note count: assets,
    media files, and one batch signing call covering originals and both WebP
    derivatives.
    """
    if not note_ids:
        return {}
    client = get_supabase_client()
    assets = (
        client.table(MEDIA_ASSETS)
        .select("id, media_file_id, target_row_id, role, position, created_at")
        .eq("tenant_id", str(tenant_id))
        .eq("target_table", TARGET_TABLE)
        .in_("target_row_id", note_ids)
        .order("position")
        .order("created_at")
        .execute()
        .data
        or []
    )
    if not assets:
        return {}

    files = (
        client.table(MEDIA_FILES)
        .select("id, url, type, kind, title, deleted_at")
        .eq("tenant_id", str(tenant_id))
        .in_("id", [a["media_file_id"] for a in assets])
        .execute()
        .data
        or []
    )
    files_by_id = {f["id"]: f for f in files if not f.get("deleted_at")}

    paths: list[str] = []
    for asset in assets:
        media = files_by_id.get(asset["media_file_id"])
        path = storage_path_from_url(media.get("url")) if media else None
        if not path:
            continue
        paths.append(path)
        if (asset.get("role") or PHOTO_ROLE) == PHOTO_ROLE:
            paths.append(derivative_path(path, "thumb"))
            paths.append(derivative_path(path, "card"))
    signed = sign_paths(paths)

    grouped: dict[str, list[dict]] = {}
    for row in _build_rows(assets, files_by_id, signed):
        grouped.setdefault(row["note_id"], []).append(row)
    return grouped


def list_for_note(tenant_id: UUID, note_id: UUID) -> list[dict]:
    return list_for_notes(tenant_id, [str(note_id)]).get(str(note_id), [])


def _next_position(client: Any, tenant_id: UUID, note_id: UUID) -> int:
    last = (
        client.table(MEDIA_ASSETS)
        .select("position")
        .eq("tenant_id", str(tenant_id))
        .eq("target_table", TARGET_TABLE)
        .eq("target_row_id", str(note_id))
        .order("position", desc=True)
        .limit(1)
        .execute()
        .data
    )
    return (last[0]["position"] + 1) if last else 0


def add_attachments(
    note_id: UUID,
    tenant_id: UUID,
    uploaded_by: UUID,
    files: list[tuple[bytes, str | None, str | None]],
) -> list[dict]:
    """Upload each `(content, mime, filename)` and link it to the note."""
    client = get_supabase_client()
    position = _next_position(client, tenant_id, note_id)

    created: list[dict] = []
    for content, mime, filename in files:
        content_type = (mime or "application/octet-stream").lower().split(";")[0].strip()
        role = role_for_mime(content_type)
        object_path = f"{tenant_id}/notes/{note_id}/{uuid4().hex}.{_extension(content_type, filename, role)}"
        client.storage.from_(MEDIA_BUCKET).upload(
            path=object_path,
            file=content,
            file_options={"content-type": content_type, "upsert": "true"},
        )
        if role == PHOTO_ROLE:
            # Best effort: the original is already stored and every reader falls
            # back to it, so a failed rendition costs bandwidth, not the photo.
            upload_derivatives(client, object_path, content)

        locator = str(client.storage.from_(MEDIA_BUCKET).get_public_url(object_path)).rstrip("?")
        media_file = (
            client.table(MEDIA_FILES)
            .insert(
                {
                    "tenant_id": str(tenant_id),
                    "url": locator,
                    # `type`/`source` keep the legacy CHECK vocabulary
                    # (20240101000011); `kind` is the modern classification.
                    "type": "photo" if role == PHOTO_ROLE else "audio",
                    "source": "gallery" if role == PHOTO_ROLE else "recorder",
                    "kind": role,
                    "uploaded_by": str(uploaded_by),
                    "title": filename,
                }
            )
            .execute()
            .data[0]
        )
        asset = (
            client.table(MEDIA_ASSETS)
            .insert(
                {
                    "tenant_id": str(tenant_id),
                    "media_file_id": media_file["id"],
                    "target_table": TARGET_TABLE,
                    "target_row_id": str(note_id),
                    "role": role,
                    "position": position,
                    "created_by": str(uploaded_by),
                }
            )
            .execute()
            .data[0]
        )
        created.append(
            {
                "id": asset["id"],
                "media_file_id": media_file["id"],
                "role": role,
                "position": position,
                "created_at": asset.get("created_at"),
                "path": storage_path_from_url(locator),
                "title": media_file.get("title"),
            }
        )
        position += 1

    logger.info(
        "note_attachments_added",
        event_type="write",
        tenant_id=str(tenant_id),
        note_id=str(note_id),
        count=len(created),
    )
    # Re-read through the list path so the response carries signed URLs and
    # derivative links built by exactly the same code the GET uses.
    return list_for_note(tenant_id, note_id)


def delete_attachment(asset_id: UUID, note_id: UUID, tenant_id: UUID) -> bool:
    """Unlink an attachment; drop the object + file row when nothing else uses it."""
    client = get_supabase_client()
    asset = (
        client.table(MEDIA_ASSETS)
        .select("id, media_file_id")
        .eq("id", str(asset_id))
        .eq("tenant_id", str(tenant_id))
        .eq("target_table", TARGET_TABLE)
        .eq("target_row_id", str(note_id))
        .limit(1)
        .execute()
        .data
    )
    if not asset:
        return False
    media_file_id = asset[0]["media_file_id"]
    client.table(MEDIA_ASSETS).delete().eq("id", str(asset_id)).eq("tenant_id", str(tenant_id)).execute()

    still_linked = client.table(MEDIA_ASSETS).select("id").eq("media_file_id", media_file_id).limit(1).execute().data
    if still_linked:
        return True

    media = (
        client.table(MEDIA_FILES)
        .select("url")
        .eq("id", media_file_id)
        .eq("tenant_id", str(tenant_id))
        .limit(1)
        .execute()
        .data
    )
    path = storage_path_from_url(media[0]["url"]) if media else None
    if path:
        # The derivatives are named deterministically, so they can be removed
        # alongside the original without having been recorded anywhere.
        targets = [path, derivative_path(path, "thumb"), derivative_path(path, "card")]
        try:
            client.storage.from_(MEDIA_BUCKET).remove(targets)
        except Exception as exc:  # noqa: BLE001 — an orphan object is recoverable, a 500 is not
            logger.error("object_delete_failed", event_type="error", path=path, error=str(exc)[:200])
    (client.table(MEDIA_FILES).update({"deleted_at": datetime.now(UTC).isoformat()}).eq("id", media_file_id).execute())
    return True
