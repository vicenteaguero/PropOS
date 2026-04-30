from __future__ import annotations

import io
from typing import Any

# pypdf import lazy: si no está instalado, devolvemos passthrough
try:
    from pypdf import PdfReader, PdfWriter

    HAS_PYPDF = True
except ImportError:  # pragma: no cover
    HAS_PYPDF = False


def extract_pdf_metadata(content: bytes) -> tuple[dict[str, Any], int | None]:
    """
    Extrae metadata + page_count del PDF.
    Retorna ({}, None) si pypdf no disponible o falla.
    """
    if not HAS_PYPDF:
        return {}, None
    try:
        reader = PdfReader(io.BytesIO(content))
        meta = {}
        if reader.metadata:
            for key, value in reader.metadata.items():
                meta[str(key).lstrip("/")] = str(value) if value is not None else None
        return meta, len(reader.pages)
    except Exception:
        return {}, None


def strip_pdf_metadata(content: bytes) -> bytes:
    """
    Devuelve PDF sin metadata identificadora (Producer, Creator, Author, Title, Subject, Keywords).
    Si pypdf no disponible o falla, devuelve contenido original (passthrough).
    """
    if not HAS_PYPDF:
        return content
    try:
        reader = PdfReader(io.BytesIO(content))
        writer = PdfWriter()
        for page in reader.pages:
            writer.add_page(page)
        # Reemplaza metadata con valores neutros
        writer.add_metadata(
            {
                "/Producer": "PropOS",
                "/Creator": "PropOS",
                "/Author": "",
                "/Title": "",
                "/Subject": "",
                "/Keywords": "",
            }
        )
        out = io.BytesIO()
        writer.write(out)
        return out.getvalue()
    except Exception:
        return content
