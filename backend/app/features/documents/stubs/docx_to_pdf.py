from __future__ import annotations

from app.features.documents.schemas import StubResult


def docx_to_pdf(_path: str) -> StubResult:
    """V1 stub. V2: LibreOffice headless o servicio externo (CloudConvert, PDF.co)."""
    return StubResult(plugin="docx_to_pdf", detail="DOCX→PDF conversion not implemented in V1")
