from __future__ import annotations

from app.core.logging.logger import get_logger
from app.core.supabase.client import get_supabase_client

BUCKET = "documents"
DEFAULT_SIGNED_URL_TTL = 3600

logger = get_logger("DOCS_STORAGE")


def upload_object(path: str, content: bytes, mime_type: str) -> None:
    client = get_supabase_client()
    client.storage.from_(BUCKET).upload(
        path=path,
        file=content,
        file_options={"content-type": mime_type, "upsert": "true"},
    )
    logger.info("uploaded", event_type="storage", path=path, size=len(content))


def delete_object(path: str) -> None:
    client = get_supabase_client()
    client.storage.from_(BUCKET).remove([path])
    logger.info("deleted", event_type="storage", path=path)


def signed_url(path: str, expires_in: int = DEFAULT_SIGNED_URL_TTL) -> str:
    client = get_supabase_client()
    response = client.storage.from_(BUCKET).create_signed_url(path, expires_in)
    if isinstance(response, dict):
        return response.get("signedURL") or response.get("signed_url") or ""
    return str(response)


def download_object(path: str) -> bytes:
    client = get_supabase_client()
    return client.storage.from_(BUCKET).download(path)


def raw_path(tenant_id: str, document_id: str, sha: str, ext: str) -> str:
    return f"{tenant_id}/1_raw/{document_id}/{sha}.{ext}"


def normalized_path(tenant_id: str, document_id: str, sha: str) -> str:
    return f"{tenant_id}/2_normalized/{document_id}/{sha}.pdf"


def thumb_path(tenant_id: str, document_id: str, sha: str, page: int) -> str:
    return f"{tenant_id}/3_thumbs/{document_id}/{sha}/p{page}.webp"


def anonymous_path(tenant_id: str, portal_id: str, upload_id: str, ext: str) -> str:
    return f"{tenant_id}/4_anonymous/{portal_id}/{upload_id}.{ext}"


def ext_for_mime(mime: str) -> str:
    return {
        "application/pdf": "pdf",
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/heic": "heic",
        "image/heif": "heif",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    }.get(mime, "bin")
