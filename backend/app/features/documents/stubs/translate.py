from __future__ import annotations

from app.features.documents.schemas import StubResult


def translate_pdf(_path: str, _target_lang: str) -> StubResult:
    """V1 stub. V2: extracción de texto + traducción + re-imposición en PDF."""
    return StubResult(plugin="translate", detail="Translation not implemented in V1")
