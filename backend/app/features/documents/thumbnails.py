"""First-page PNG thumbnails for PDF documents.

Uses pypdfium2 (bundled binary, no system poppler dependency) to render the
first page of a PDF as a small PNG. Output is sized for documents grid cards
(~400px tall) and aggressively compressed via Pillow optimize=True.

Generation runs synchronously on upload. Failures are logged and swallowed by
callers — thumbnails are best-effort UX, never block a successful upload.
"""

from __future__ import annotations

import io

import pypdfium2 as pdfium
from PIL import Image

from app.core.logging.logger import get_logger

logger = get_logger("DOCS_THUMBS")

TARGET_HEIGHT_PX = 400
# pypdfium2 uses scale factor (1.0 = 72 DPI). For ~400px tall on a Letter
# page (~792 PDF units tall) we need scale ~= 400/792 ~= 0.5.
DEFAULT_SCALE = 0.55
MAX_OUTPUT_BYTES = 30 * 1024


def generate_first_page_png(pdf_bytes: bytes) -> bytes:
    """Render the first page of a PDF to a compressed PNG (~400px tall).

    Raises ValueError if the PDF cannot be opened or has no pages.
    """
    if not pdf_bytes:
        raise ValueError("Empty PDF content")

    pdf = pdfium.PdfDocument(pdf_bytes)
    try:
        if len(pdf) == 0:
            raise ValueError("PDF has no pages")
        page = pdf[0]
        try:
            bitmap = page.render(scale=DEFAULT_SCALE)
            pil_image: Image.Image = bitmap.to_pil()
        finally:
            page.close()
    finally:
        pdf.close()

    # Resize to exact target height keeping aspect ratio.
    if pil_image.height != TARGET_HEIGHT_PX:
        ratio = TARGET_HEIGHT_PX / float(pil_image.height)
        new_size = (max(1, int(pil_image.width * ratio)), TARGET_HEIGHT_PX)
        pil_image = pil_image.resize(new_size, Image.Resampling.LANCZOS)

    # Convert to palette mode (P) with adaptive palette to drop bytes hard.
    # Falls back to RGB if conversion fails (very rare).
    try:
        quantized = pil_image.convert("RGB").quantize(colors=128, method=Image.Quantize.MEDIANCUT)
    except (ValueError, OSError):
        quantized = pil_image.convert("RGB")

    buf = io.BytesIO()
    quantized.save(buf, format="PNG", optimize=True)
    data = buf.getvalue()
    if len(data) > MAX_OUTPUT_BYTES:
        # Retry with stronger quantization.
        try:
            harder = pil_image.convert("RGB").quantize(colors=64, method=Image.Quantize.MEDIANCUT)
            buf = io.BytesIO()
            harder.save(buf, format="PNG", optimize=True)
            data = buf.getvalue()
        except (ValueError, OSError):
            pass
    return data


def thumbnail_path(tenant_id: str, document_id: str, version_number: int) -> str:
    return f"{tenant_id}/4_thumbnails/{document_id}/v{version_number}.png"
