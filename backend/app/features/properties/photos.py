"""Property photo gallery: `media_assets` → `media_files` reads and uploads.

The agent already writes `media_assets` rows (`target_table='properties'`) when a
broker sends photos over WhatsApp, but nothing ever read them back. This module
is that read path, plus a direct upload path for the web UI.

URLs are never served raw: `media_files.url` stores the canonical object locator
and every response carries a freshly signed URL, so the `media` bucket can be
private. External URLs (media we did not upload) pass through untouched.
"""

from __future__ import annotations

import io
import threading
import time
from datetime import UTC, datetime
from typing import Any
from urllib.parse import unquote, urlparse
from uuid import UUID, uuid4

from PIL import Image, ImageOps

from app.core.logging.logger import get_logger
from app.core.supabase.client import get_supabase_client

try:  # HEIC/HEIF come straight off iPhones; without this Pillow cannot open them.
    import pillow_heif

    pillow_heif.register_heif_opener()
except Exception:  # noqa: BLE001 — derivatives are optional, the original still serves
    pass

MEDIA_BUCKET = "media"
MEDIA_ASSETS = "media_assets"
MEDIA_FILES = "media_files"
PROPERTIES_TABLE = "properties"
TARGET_TABLE = "properties"
PHOTO_ROLE = "PHOTO"

DEFAULT_SIGNED_URL_TTL = 3600

# How long a signed URL is handed back out of the process cache.
#
# The URL carries a token, so re-signing the same object produces a DIFFERENT
# string every time — and a different string is a cache miss for the browser and
# for the service worker's CacheFirst rule alike. The photos were therefore
# re-downloaded on every load of the property list even though the bytes had not
# changed; the `media` bucket holds 736 objects and 52 MB.
#
# Reusing the URL for most of its life makes it stable enough to be cached.
# Well inside the hour it is valid for, so a client that starts a download at
# the end of the window still finishes it.
_URL_CACHE_TTL_SECONDS = 50 * 60
_URL_CACHE_MAX = 2048
_url_cache: dict[str, tuple[float, str]] = {}
_url_lock = threading.Lock()


def _cached_urls(paths: list[str]) -> tuple[dict[str, str], list[str]]:
    """Split `paths` into what the cache can answer and what must be signed."""
    now = time.monotonic()
    hits: dict[str, str] = {}
    misses: list[str] = []
    with _url_lock:
        for path in paths:
            entry = _url_cache.get(path)
            # Absolute deadline, and `-inf` on a miss: time.monotonic()'s epoch
            # is arbitrary, so a 0.0 default reads as fresh during a process's
            # first minutes. Same trap documented in agent/budget.py.
            if entry and now < entry[0]:
                hits[path] = entry[1]
            else:
                misses.append(path)
    return hits, misses


def _remember_urls(signed: dict[str, str]) -> None:
    if not signed:
        return
    now = time.monotonic()
    with _url_lock:
        if len(_url_cache) + len(signed) > _URL_CACHE_MAX:
            for key in [k for k, entry in _url_cache.items() if entry[0] <= now]:
                del _url_cache[key]
            if len(_url_cache) + len(signed) > _URL_CACHE_MAX:
                _url_cache.clear()
        # Room left after the sweep. A single batch can be larger than the whole
        # cap — a tenant with thousands of photos on one page — and clearing
        # first does not help if the insert then overshoots anyway. The tail is
        # simply not cached; those paths re-sign next time.
        room = _URL_CACHE_MAX - len(_url_cache)
        for path, url in list(signed.items())[:room]:
            _url_cache[path] = (now + _URL_CACHE_TTL_SECONDS, url)


def reset_url_cache() -> None:
    """Drop every cached signed URL. For tests."""
    with _url_lock:
        _url_cache.clear()


# Long-edge box for each WebP derivative generated beside the original.
# `thumb` feeds list covers and the gallery strip, `card` the hero; the
# lightbox is the only surface that still loads the full-resolution original.
DERIVATIVE_SIZES: dict[str, int] = {"thumb": 400, "card": 800}
DERIVATIVE_QUALITY = 78
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
    hits, misses = _cached_urls([path])
    if not misses:
        return hits[path]
    client = get_supabase_client()
    response = client.storage.from_(MEDIA_BUCKET).create_signed_url(path, expires_in)
    if isinstance(response, dict):
        url = response.get("signedURL") or response.get("signed_url") or ""
    else:
        url = str(response)
    if url and expires_in == DEFAULT_SIGNED_URL_TTL:
        # Only the default TTL is cached: a caller asking for a shorter-lived
        # URL wants a shorter-lived URL, and handing it a 50-minute one back
        # would quietly ignore that.
        _remember_urls({path: url})
    return url


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


def derivative_path(object_path: str, variant: str) -> str:
    """Storage path of a derivative, derived from the original's path.

    Deterministic on purpose: nothing records which derivatives exist, so every
    consumer can name them without a lookup and `sign_many` decides availability
    from whether the object signs.
    """
    base = object_path.rsplit(".", 1)[0] if "." in object_path.rsplit("/", 1)[-1] else object_path
    return f"{base}.{variant}.webp"


def build_derivatives(content: bytes) -> dict[str, bytes]:
    """WebP renditions keyed by variant name. Empty when the bytes are unreadable.

    `exif_transpose` first: iPhone photos carry rotation in EXIF, which WebP
    output drops — without it landscape shots would render on their side.
    """
    try:
        with Image.open(io.BytesIO(content)) as source:
            image = ImageOps.exif_transpose(source) or source
            image = image.convert("RGB")
            out: dict[str, bytes] = {}
            for variant, edge in DERIVATIVE_SIZES.items():
                copy = image.copy()
                copy.thumbnail((edge, edge), Image.LANCZOS)
                buffer = io.BytesIO()
                copy.save(buffer, format="WEBP", quality=DERIVATIVE_QUALITY, method=4)
                out[variant] = buffer.getvalue()
            return out
    except Exception as exc:  # noqa: BLE001 — an undecodable upload must still store
        logger.warning("derivatives_failed", event_type="error", error=str(exc)[:200])
        return {}


def upload_derivatives(client: Any, object_path: str, content: bytes) -> list[str]:
    """Write the WebP derivatives beside `object_path`. Returns the paths written.

    Best effort by design: the original is already stored and every consumer
    falls back to it, so a failure here degrades quality, not correctness.
    """
    written: list[str] = []
    for variant, data in build_derivatives(content).items():
        path = derivative_path(object_path, variant)
        try:
            client.storage.from_(MEDIA_BUCKET).upload(
                path=path,
                file=data,
                file_options={"content-type": "image/webp", "upsert": "true"},
            )
            written.append(path)
        except Exception as exc:  # noqa: BLE001
            logger.warning("derivative_upload_failed", event_type="error", path=path, error=str(exc)[:200])
    return written


def sign_many(paths: list[str], expires_in: int = DEFAULT_SIGNED_URL_TTL) -> dict[str, str]:
    """Sign many objects in ONE request. Missing objects are simply absent.

    Storage's batch endpoint reports per-path failures instead of raising, which
    is what lets callers name a derivative that may not have been generated yet
    and fall back to the original without a prior existence check.
    """
    unique = list(dict.fromkeys(p for p in paths if p))
    if not unique:
        return {}

    cacheable = expires_in == DEFAULT_SIGNED_URL_TTL
    hits, misses = _cached_urls(unique) if cacheable else ({}, unique)
    if not misses:
        return hits

    client = get_supabase_client()
    try:
        results = client.storage.from_(MEDIA_BUCKET).create_signed_urls(misses, expires_in)
    except Exception as exc:  # noqa: BLE001 — a page of broken images beats a 500
        logger.error("batch_sign_failed", event_type="error", count=len(misses), error=str(exc)[:200])
        return hits
    signed: dict[str, str] = {}
    for item in results or []:
        if item.get("error"):
            continue
        url = item.get("signedURL") or item.get("signedUrl")
        path = item.get("path")
        if url and path:
            signed[unquote(path)] = url
    if cacheable:
        _remember_urls(signed)
    return {**hits, **signed}


def _variant_url(signed: dict[str, str], path: str | None, variant: str, fallback: str) -> str:
    """Signed derivative, or `fallback` when it was never generated."""
    if not path:
        return fallback
    return signed.get(derivative_path(path, variant)) or fallback


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

        # One batch sign for the whole gallery — originals plus both derivatives.
        # Signing per photo meant 3 round trips per image; a 40-photo property
        # spent 120 requests before the first byte of markup left the server.
        wanted: list[str] = []
        for media in by_id.values():
            path = storage_path_from_url(media.get("url"))
            if not path:
                continue
            wanted.append(path)
            wanted.extend(derivative_path(path, v) for v in DERIVATIVE_SIZES)
        signed = sign_many(wanted)

        photos: list[dict] = []
        for asset in assets:
            media = by_id.get(asset["media_file_id"])
            if media is None:
                continue
            stored = media.get("url")
            path = storage_path_from_url(stored)
            # External media (nothing we uploaded) has no path and no derivatives;
            # it passes through verbatim on all three fields.
            original = signed.get(path or "", stored or "") if path else (stored or "")
            photos.append(
                {
                    "id": asset["id"],
                    "media_file_id": asset["media_file_id"],
                    "url": original,
                    "thumb_url": _variant_url(signed, path, "thumb", original),
                    "card_url": _variant_url(signed, path, "card", original),
                    "role": asset.get("role") or PHOTO_ROLE,
                    "position": asset.get("position") or 0,
                    "title": media.get("title"),
                    "created_at": asset.get("created_at"),
                }
            )
        return photos

    @staticmethod
    async def covers_for_properties(property_ids: list[UUID], tenant_id: UUID) -> dict[str, str]:
        """Lowest-`position` photo per property, as a signed `card` URL.

        Three queries and one batch sign for the whole page, regardless of how
        many properties it holds — the list grid used to have no photo at all
        precisely because the per-property photo endpoint could not be afforded
        40 times over.
        """
        if not property_ids:
            return {}
        client = get_supabase_client()
        ids = [str(pid) for pid in property_ids]
        assets = (
            client.table(MEDIA_ASSETS)
            .select("media_file_id, target_row_id, position, created_at")
            .eq("tenant_id", str(tenant_id))
            .eq("target_table", TARGET_TABLE)
            .in_("target_row_id", ids)
            .eq("role", PHOTO_ROLE)
            .order("position")
            .order("created_at")
            .execute()
            .data
            or []
        )
        # Ordered by (position, created_at), so the first row seen per property
        # is its cover. PostgREST has no DISTINCT ON, hence the client-side pick.
        first_by_property: dict[str, str] = {}
        for asset in assets:
            first_by_property.setdefault(asset["target_row_id"], asset["media_file_id"])
        if not first_by_property:
            return {}

        files = (
            client.table(MEDIA_FILES)
            .select("id, url, deleted_at")
            .in_("id", list(dict.fromkeys(first_by_property.values())))
            .eq("tenant_id", str(tenant_id))
            .execute()
            .data
            or []
        )
        url_by_file = {f["id"]: f["url"] for f in files if not f.get("deleted_at")}

        paths: dict[str, str | None] = {
            pid: storage_path_from_url(url_by_file.get(file_id)) for pid, file_id in first_by_property.items()
        }
        wanted = [derivative_path(path, "card") for path in paths.values() if path]
        wanted += [path for path in paths.values() if path]
        signed = sign_many(wanted)

        covers: dict[str, str] = {}
        for pid, path in paths.items():
            file_id = first_by_property[pid]
            stored = url_by_file.get(file_id)
            if not stored:
                continue
            original = signed.get(path, stored) if path else stored
            covers[pid] = _variant_url(signed, path, "card", original)
        return covers

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
            # Derivatives live beside the original under a derived path, so no
            # column has to record them and the backfill can produce the same
            # names for photos uploaded before this existed.
            upload_derivatives(client, object_path, content)
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
            signed_original = display_url(locator)
            derived = sign_many([derivative_path(object_path, v) for v in DERIVATIVE_SIZES])
            created.append(
                {
                    "id": asset["id"],
                    "media_file_id": media_file["id"],
                    "url": signed_original,
                    "thumb_url": _variant_url(derived, object_path, "thumb", signed_original),
                    "card_url": _variant_url(derived, object_path, "card", signed_original),
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
                    # Derivatives are not tracked anywhere, so they can only be
                    # collected here, by name, alongside the original.
                    client.storage.from_(MEDIA_BUCKET).remove(
                        [path, *(derivative_path(path, v) for v in DERIVATIVE_SIZES)]
                    )
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
