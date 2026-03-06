from __future__ import annotations

from app.core.logging.logger import get_logger
from app.core.supabase.client import get_supabase_client

STORAGE_BUCKET = "documents"

logger = get_logger("STORAGE")


def upload_file(
    file_path: str,
    file_content: bytes,
    content_type: str,
) -> dict:
    client = get_supabase_client()
    logger.info(
        "uploading",
        event_type="write",
        file_path=file_path,
    )
    response = client.storage.from_(STORAGE_BUCKET).upload(
        path=file_path,
        file=file_content,
        file_options={"content-type": content_type},
    )
    return response


def get_file_url(file_path: str) -> str:
    client = get_supabase_client()
    logger.info(
        "generating_url",
        event_type="query",
        file_path=file_path,
    )
    response = client.storage.from_(STORAGE_BUCKET).create_signed_url(
        path=file_path,
        expires_in=3600,
    )
    return response["signedURL"]


def delete_file(file_path: str) -> None:
    client = get_supabase_client()
    logger.info(
        "deleting",
        event_type="delete",
        file_path=file_path,
    )
    client.storage.from_(STORAGE_BUCKET).remove([file_path])
