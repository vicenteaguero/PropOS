from __future__ import annotations

import io
import zipfile

from fastapi import HTTPException, status

MAX_FILE_BYTES = 50 * 1024 * 1024

ALLOWED_MIME = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

HEIC_BRANDS = {b"heic", b"heix", b"mif1", b"msf1", b"hevc", b"heim", b"heis", b"hevm", b"hevs"}

DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

# (signature_bytes, offset, mime_type) — primer match gana
MAGIC_SIGNATURES: list[tuple[bytes, int, str]] = [
    (b"%PDF-", 0, "application/pdf"),
    (b"\xff\xd8\xff", 0, "image/jpeg"),
    (b"\x89PNG\r\n\x1a\n", 0, "image/png"),
    (b"RIFF", 0, "image/webp"),
    # DOCX = ZIP container PK\x03\x04. Verificamos contenido [Content_Types].xml + word/document.xml
    (b"PK\x03\x04", 0, DOCX_MIME),
]


def _looks_like_docx(content: bytes) -> bool:
    """Verifica que un ZIP es realmente DOCX (no JAR/APK/ZIP arbitrario)."""
    try:
        with zipfile.ZipFile(io.BytesIO(content)) as zf:
            names = set(zf.namelist())
            return "[Content_Types].xml" in names and "word/document.xml" in names
    except (zipfile.BadZipFile, KeyError, OSError):
        return False


def detect_mime(content: bytes) -> str | None:
    # HEIC/HEIF: bytes 4..8 == "ftyp", brand at 8..12 in HEIC_BRANDS
    if len(content) >= 12 and content[4:8] == b"ftyp" and content[8:12] in HEIC_BRANDS:
        return "image/heic"
    for sig, offset, mime in MAGIC_SIGNATURES:
        if content[offset : offset + len(sig)] == sig:
            if mime == "image/webp":
                if content[8:12] != b"WEBP":
                    continue
            if mime == DOCX_MIME and not _looks_like_docx(content):
                continue
            return mime
    return None


def validate_upload(
    content: bytes,
    declared_mime: str | None = None,
    max_bytes: int = MAX_FILE_BYTES,
) -> str:
    """
    Valida tamaño + magic bytes + MIME whitelist.
    Retorna MIME detectado (no el declarado, no se confía en client).
    """
    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty file",
        )
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum size of {max_bytes} bytes",
        )
    detected = detect_mime(content)
    if detected is None:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Unsupported or unrecognized file type (magic bytes failed)",
        )
    if detected not in ALLOWED_MIME:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"File type not allowed: {detected}",
        )
    if declared_mime and declared_mime not in ALLOWED_MIME:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Declared MIME not allowed: {declared_mime}",
        )
    return detected


def kind_from_mime(mime: str) -> str:
    if mime == "application/pdf":
        return "PDF"
    if mime == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        return "DOCX"
    if mime in {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}:
        return "IMAGE_PDF"
    return "OTHER"
