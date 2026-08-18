"""Property photo gallery: `media_assets` → `media_files` reads and uploads.

The agent already writes `media_assets` rows (`target_table='properties'`) when a
broker sends photos over WhatsApp, but nothing ever read them back. This module
is that read path, plus a direct upload path for the web UI.

URLs are never served raw: `media_files.url` stores the canonical object locator
and every response carries a freshly signed URL, so the `media` bucket can be
private. External URLs (media we did not upload) pass through untouched.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from urllib.parse import unquote, urlparse
from uuid import UUID, uuid4

from app.core.logging.logger import get_logger
from app.core.supabase.client import get_supabase_client

MEDIA_BUCKET = "media"
MEDIA_ASSETS = "media_assets"
MEDIA_FILES = "media_files"
PROPERTIES_TABLE = "properties"
TARGET_TABLE = "properties"
PHOTO_ROLE = "PHOTO"

DEFAULT_SIGNED_URL_TTL = 3600
MAX_PHOTO_BYTES = 15 * 1024 * 1024
MAX_PHOTOS_PER_REQUEST = 20

ALLOWED_IMAGE_MIME = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
    "image/avif",
    "image/gif",
}

_EXT_BY_MIME = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
    "image/avif": "avif",
    "image/gif": "gif",
}

# Supabase Storage serves objects under /storage/v1/object/{access}/{bucket}/{path}.
_OBJECT_MARKER = "/storage/v1/object/"
_ACCESS_PREFIXES = ("public/", "sign/", "authenticated/")

logger = get_logger("PROPERTY_PHOTOS")


class PropertyNotFoundError(LookupError):
    """Property missing, soft-deleted, or owned by another tenant."""


def ext_for(mime: str | None, filename: str | None) -> str:
    """Extension for the stored object: mime first, filename suffix as fallback."""
    if mime and mime.lower() in _EXT_BY_MIME:
        return _EXT_BY_MIME[mime.lower()]
    if filename and "." in filename:
        candidate = filename.rsplit(".", 1)[-1].lower()
        if candidate.isalnum() and len(candidate) <= 5:
            return candidate
    return "jpg"


def storage_path_from_url(url: str | None) -> str | None:
    """Object path inside the `media` bucket, or None when the URL is not ours.

    Tolerates every access form Supabase emits (`public/`, `sign/`,
    `authenticated/`, bare) so rows written before the bucket went private still
    resolve.
    """
    if not url:
        return None
    path = urlparse(url).path
    marker = path.find(_OBJECT_MARKER)
    if marker == -1:
        return None
    rest = path[marker + len(_OBJECT_MARKER) :]
    for prefix in _ACCESS_PREFIXES:
        if rest.startswith(prefix):
            rest = rest[len(prefix) :]
            break
    if not rest.startswith(f"{MEDIA_BUCKET}/"):
        return None
    return unquote(rest[len(MEDIA_BUCKET) + 1 :]) or None


def signed_url(path: str, expires_in: int = DEFAULT_SIGNED_URL_TTL) -> str:
    client = get_supabase_client()
    response = client.storage.from_(MEDIA_BUCKET).create_signed_url(path, expires_in)
    if isinstance(response, dict):
        return response.get("signedURL") or response.get("signed_url") or ""
    return str(response)


def display_url(stored_url: str | None, expires_in: int = DEFAULT_SIGNED_URL_TTL) -> str:
    """Signed URL for media we own; the stored URL verbatim for anything else."""
    path = storage_path_from_url(stored_url)
    if not path:
        return stored_url or ""
    try:
        return signed_url(path, expires_in) or (stored_url or "")
    except Exception as exc:  # noqa: BLE001 — a broken thumbnail must not 500 the page
        logger.error("sign_failed", event_type="error", path=path, error=str(exc)[:200])
        return stored_url or ""


def _assert_property(client: Any, property_id: UUID, tenant_id: UUID) -> None:
    found = (
        client.table(PROPERTIES_TABLE)
        .select("id")
        .eq("id", str(property_id))
        .eq("tenant_id", str(tenant_id))
        .limit(1)
        .execute()
        .data
    )
    if not found:
        raise PropertyNotFoundError(str(property_id))


def _next_position(client: Any, property_id: UUID, tenant_id: UUID) -> int:
    last = (
        client.table(MEDIA_ASSETS)
        .select("position")
        .eq("tenant_id", str(tenant_id))
        .eq("target_table", TARGET_TABLE)
        .eq("target_row_id", str(property_id))
        .order("position", desc=True)
        .limit(1)
        .execute()
        .data
    )
    return (last[0]["position"] + 1) if last else 0


class PropertyPhotoService:
    @staticmethod
    async def list_photos(property_id: UUID, tenant_id: UUID) -> list[dict]:
        client = get_supabase_client()
        _assert_property(client, property_id, tenant_id)
        assets = (
            client.table(MEDIA_ASSETS)
            .select("id, media_file_id, role, position, created_at")
            .eq("tenant_id", str(tenant_id))
            .eq("target_table", TARGET_TABLE)
            .eq("target_row_id", str(property_id))
            .order("position")
            .order("created_at")
            .execute()
            .data
            or []
        )
        if not assets:
            return []

        files = (
            client.table(MEDIA_FILES)
            .select("id, url, type, kind, title, deleted_at")
            .in_("id", [a["media_file_id"] for a in assets])
            .eq("tenant_id", str(tenant_id))
            .execute()
            .data
            or []
        )
        by_id = {f["id"]: f for f in files if not f.get("deleted_at")}

        photos: list[dict] = []
        for asset in assets:
            media = by_id.get(asset["media_file_id"])
            if media is None:
                continue
            photos.append(
                {
                    "id": asset["id"],
                    "media_file_id": asset["media_file_id"],
                    "url": display_url(media.get("url")),
                    "role": asset.get("role") or PHOTO_ROLE,
                    "position": asset.get("position") or 0,
                    "title": media.get("title"),
                    "created_at": asset.get("created_at"),
                }
            )
        return photos

    @staticmethod
    async def add_photos(
        property_id: UUID,
        tenant_id: UUID,
        uploaded_by: UUID,
        files: list[tuple[bytes, str | None, str | None]],
    ) -> list[dict]:
        """Upload each `(content, mime, filename)` and link it to the property."""
        client = get_supabase_client()
        _assert_property(client, property_id, tenant_id)
        position = _next_position(client, property_id, tenant_id)

        created: list[dict] = []
        for content, mime, filename in files:
            content_type = (mime or "image/jpeg").lower()
            object_path = f"{tenant_id}/properties/{property_id}/{uuid4().hex}.{ext_for(content_type, filename)}"
            client.storage.from_(MEDIA_BUCKET).upload(
                path=object_path,
                file=content,
                file_options={"content-type": content_type, "upsert": "true"},
            )
            # Canonical locator only — reads always go through display_url().
            locator = str(client.storage.from_(MEDIA_BUCKET).get_public_url(object_path)).rstrip("?")

            media_file = (
                client.table(MEDIA_FILES)
                .insert(
                    {
                        "tenant_id": str(tenant_id),
                        "url": locator,
                        # `type`/`source` are CHECK-constrained to the legacy vocabulary.
                        "type": "photo",
                        "source": "gallery",
                        "kind": PHOTO_ROLE,
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
                        "target_row_id": str(property_id),
                        "role": PHOTO_ROLE,
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
                    "url": display_url(locator),
                    "role": PHOTO_ROLE,
                    "position": position,
                    "title": media_file.get("title"),
                    "created_at": asset.get("created_at"),
                }
            )
            position += 1

        logger.info(
            "photos_added",
            event_type="write",
            tenant_id=str(tenant_id),
            property_id=str(property_id),
            count=len(created),
        )
        return created

    @staticmethod
    async def delete_photo(asset_id: UUID, property_id: UUID, tenant_id: UUID) -> bool:
        """Unlink a photo. Drops the object + file row when nothing else uses it."""
        client = get_supabase_client()
        asset = (
            client.table(MEDIA_ASSETS)
            .select("id, media_file_id")
            .eq("id", str(asset_id))
            .eq("tenant_id", str(tenant_id))
            .eq("target_table", TARGET_TABLE)
            .eq("target_row_id", str(property_id))
            .limit(1)
            .execute()
            .data
        )
        if not asset:
            return False
        media_file_id = asset[0]["media_file_id"]

        client.table(MEDIA_ASSETS).delete().eq("id", str(asset_id)).eq("tenant_id", str(tenant_id)).execute()

        still_linked = (
            client.table(MEDIA_ASSETS).select("id").eq("media_file_id", media_file_id).limit(1).execute().data
        )
        if not still_linked:
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
                try:
                    client.storage.from_(MEDIA_BUCKET).remove([path])
                except Exception as exc:  # noqa: BLE001 — orphan object is recoverable, a 500 is not
                    logger.error("object_delete_failed", event_type="error", path=path, error=str(exc)[:200])
            (
                client.table(MEDIA_FILES)
                .update({"deleted_at": datetime.now(UTC).isoformat()})
                .eq("id", media_file_id)
                .execute()
            )

        logger.info(
            "photo_deleted",
            event_type="write",
            tenant_id=str(tenant_id),
            property_id=str(property_id),
            asset_id=str(asset_id),
        )
        return True
