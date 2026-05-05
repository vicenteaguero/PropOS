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


_heif_registered = False


def _ensure_heif() -> bool:
    """Try to register HEIF/HEIC opener with Pillow once. Returns True if available."""
    global _heif_registered
    if _heif_registered:
        return True
    try:
        from pillow_heif import register_heif_opener  # type: ignore[import-not-found]

        register_heif_opener()
        _heif_registered = True
        return True
    except Exception:  # noqa: BLE001
        return False


def _quantize_to_png(pil_image: Image.Image) -> bytes:
    """Resize longest side ≤ TARGET_HEIGHT_PX, palette-quantize, return PNG bytes ≤ MAX_OUTPUT_BYTES."""
    longest = max(pil_image.width, pil_image.height)
    if longest > TARGET_HEIGHT_PX:
        ratio = TARGET_HEIGHT_PX / float(longest)
        new_size = (max(1, int(pil_image.width * ratio)), max(1, int(pil_image.height * ratio)))
        pil_image = pil_image.resize(new_size, Image.Resampling.LANCZOS)

    rgb = pil_image.convert("RGB")
    try:
        quantized = rgb.quantize(colors=128, method=Image.Quantize.MEDIANCUT)
    except (ValueError, OSError):
        quantized = rgb

    buf = io.BytesIO()
    quantized.save(buf, format="PNG", optimize=True)
    data = buf.getvalue()
    if len(data) > MAX_OUTPUT_BYTES:
        try:
            harder = rgb.quantize(colors=64, method=Image.Quantize.MEDIANCUT)
            buf = io.BytesIO()
            harder.save(buf, format="PNG", optimize=True)
            data = buf.getvalue()
        except (ValueError, OSError):
            pass
    return data


SUPPORTED_IMAGE_MIMES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
}


def generate_image_thumbnail(image_bytes: bytes, mime: str) -> bytes:
    """Decode raster image, resize to ≤400px longest side, palette-quantize, return PNG ≤30KB.

    Supports JPEG/PNG/WebP/HEIC/HEIF. Raises ValueError on empty input or unsupported mime,
    or when HEIC/HEIF is requested but pillow-heif is not installed.
    """
    if not image_bytes:
        raise ValueError("Empty image content")
    mime_lower = (mime or "").lower()
    if mime_lower not in SUPPORTED_IMAGE_MIMES:
        raise ValueError(f"Unsupported image mime: {mime}")
    if mime_lower in {"image/heic", "image/heif"} and not _ensure_heif():
        raise ValueError("HEIC/HEIF support requires pillow-heif")

    try:
        pil_image = Image.open(io.BytesIO(image_bytes))
        pil_image.load()
    except Exception as exc:  # noqa: BLE001
        raise ValueError(f"Could not decode image: {exc}") from exc

    return _quantize_to_png(pil_image)


def thumbnail_path(tenant_id: str, document_id: str, version_number: int) -> str:
    return f"{tenant_id}/4_thumbnails/{document_id}/v{version_number}.png"
