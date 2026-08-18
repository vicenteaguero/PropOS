"""Bucket-parameterized Supabase Storage helpers.

``features/documents/storage.py`` came first and pins its bucket at module
level, so anything needing a different bucket (``media``) goes through here.
Buckets are private: reads hand out short-lived signed URLs and nothing ever
calls ``get_public_url``.
"""

from __future__ import annotations

from urllib.parse import urlsplit

from app.core.logging.logger import get_logger
from app.core.supabase.client import get_supabase_client

logger = get_logger("STORAGE")

MEDIA_BUCKET = "media"
DEFAULT_SIGNED_URL_TTL = 3600


def upload_object(bucket: str, path: str, content: bytes, mime_type: str) -> None:
    client = get_supabase_client()
    client.storage.from_(bucket).upload(
        path=path,
        file=content,
        file_options={"content-type": mime_type, "upsert": "true"},
    )
    logger.info("uploaded", event_type="storage", bucket=bucket, path=path, size=len(content))


def delete_object(bucket: str, path: str) -> None:
    client = get_supabase_client()
    client.storage.from_(bucket).remove([path])
    logger.info("deleted", event_type="storage", bucket=bucket, path=path)


def download_object(bucket: str, path: str) -> bytes:
    client = get_supabase_client()
    return client.storage.from_(bucket).download(path)


def signed_url(bucket: str, path: str, expires_in: int = DEFAULT_SIGNED_URL_TTL) -> str:
    client = get_supabase_client()
    response = client.storage.from_(bucket).create_signed_url(path, expires_in)
    if isinstance(response, dict):
        return response.get("signedURL") or response.get("signed_url") or ""
    return str(response)


def object_path(bucket: str, ref: str) -> str | None:
    """Bucket-relative path for a stored reference.

    ``ref`` is normally already a path. Rows written while the bucket was
    public hold a full ``…/storage/v1/object/public/<bucket>/<path>`` URL, so
    unwind those instead of handing them back as if they still resolved.
    """
    if not ref:
        return None
    if not ref.startswith(("http://", "https://")):
        return ref.lstrip("/")
    path = urlsplit(ref).path
    for marker in (f"/object/public/{bucket}/", f"/object/sign/{bucket}/", f"/object/{bucket}/"):
        if marker in path:
            return path.split(marker, 1)[1]
    return None


def signed_url_for_ref(bucket: str, ref: str, expires_in: int = DEFAULT_SIGNED_URL_TTL) -> str | None:
    """Sign whatever a row stored: a path, or a legacy public URL."""
    path = object_path(bucket, ref)
    if not path:
        logger.warning("unrecognized_storage_ref", event_type="storage", bucket=bucket, ref=str(ref)[:200])
        return None
    return signed_url(bucket, path, expires_in) or None
