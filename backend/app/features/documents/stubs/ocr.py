from __future__ import annotations

from app.features.documents.schemas import StubResult


def ocr_pdf(_path: str) -> StubResult:
    """V1 stub. V2: conectar Tesseract (pytesseract) o servicio externo (Google Vision, AWS Textract)."""
    return StubResult(plugin="ocr", detail="OCR not implemented in V1")
