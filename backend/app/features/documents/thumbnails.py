"""First-page thumbnails for documents.

Uses pypdfium2 (bundled binary, no system poppler dependency) to render the
first page of a PDF, and Pillow for raster images. Output is sized for the
documents grid (~400px tall).

Output is WebP. Measured against the palette-quantized PNG this used to emit,
at the same 400px and visually indistinguishable:

    clean digital pdf     2.7 KB -> 1.7 KB
    scanned page         37.2 KB -> 2.0 KB
    phone photo of a doc 84.9 KB -> 13.0 KB

Note the middle and bottom rows: the PNG encoder was quietly *exceeding*
MAX_OUTPUT_BYTES on anything with paper grain, because its only recourse is a
single retry at 64 colours and it returns the result whatever the size. Noise is
the worst case for a palette, and a scan is nothing but noise. So this is not
only smaller, it is the first version where the cap actually holds.

One asset serves both the grid tile and the 48x64 list rail — the browser
downscales, and a second stored size would cost a second render, a second
failure mode and a second request per row while breaking cache sharing between
the two view modes.

`thumbnail_path` still takes an extension, and rows written before this change
keep their `.png` paths: the path is a stored string, so reading is
extension-agnostic and there is nothing to migrate.

Generation runs synchronously on upload. Failures are logged and swallowed by
callers — thumbnails are best-effort UX, never block a successful upload.
"""

from __future__ import annotations

import io
import re
import zipfile

import pypdfium2 as pdfium
from PIL import Image, ImageDraw, ImageFont

from app.core.logging.logger import get_logger

logger = get_logger("DOCS_THUMBS")

TARGET_HEIGHT_PX = 400
# pypdfium2 uses scale factor (1.0 = 72 DPI). For ~400px tall on a Letter
# page (~792 PDF units tall) we need scale ~= 400/792 ~= 0.5.
DEFAULT_SCALE = 0.55
MAX_OUTPUT_BYTES = 30 * 1024

THUMBNAIL_MIME = "image/webp"
THUMBNAIL_EXT = "webp"
# 72 is where WebP stops being distinguishable from the source at this size for
# scanned text, which is what almost every document here is.
WEBP_QUALITY = 72
# Only used if a WebP somehow overshoots the byte cap, which at 400px it does
# not for documents — kept so the cap is enforced rather than assumed.
WEBP_QUALITY_FALLBACK = 55


def _encode_webp(pil_image: Image.Image) -> bytes:
    """Encode to WebP under MAX_OUTPUT_BYTES, dropping quality once if needed."""
    rgb = pil_image.convert("RGB")
    buf = io.BytesIO()
    rgb.save(buf, format="WEBP", quality=WEBP_QUALITY, method=4)
    data = buf.getvalue()
    if len(data) > MAX_OUTPUT_BYTES:
        buf = io.BytesIO()
        rgb.save(buf, format="WEBP", quality=WEBP_QUALITY_FALLBACK, method=4)
        data = buf.getvalue()
    return data


def _fit_height(pil_image: Image.Image) -> Image.Image:
    if pil_image.height == TARGET_HEIGHT_PX:
        return pil_image
    ratio = TARGET_HEIGHT_PX / float(pil_image.height)
    return pil_image.resize((max(1, int(pil_image.width * ratio)), TARGET_HEIGHT_PX), Image.Resampling.LANCZOS)


def _fit_longest(pil_image: Image.Image) -> Image.Image:
    longest = max(pil_image.width, pil_image.height)
    if longest <= TARGET_HEIGHT_PX:
        return pil_image
    ratio = TARGET_HEIGHT_PX / float(longest)
    return pil_image.resize(
        (max(1, int(pil_image.width * ratio)), max(1, int(pil_image.height * ratio))),
        Image.Resampling.LANCZOS,
    )


def generate_first_page_png(pdf_bytes: bytes) -> bytes:
    """Render the first page of a PDF to a compressed WebP (~400px tall).

    Name kept for the call sites that predate the format change; the output is
    WebP, not PNG. Raises ValueError if the PDF cannot be opened or has no pages.
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

    return _encode_webp(_fit_height(pil_image))


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
    """Resize longest side <= TARGET_HEIGHT_PX and encode. Name predates WebP."""
    return _encode_webp(_fit_longest(pil_image))


SUPPORTED_IMAGE_MIMES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
}


def generate_image_thumbnail(image_bytes: bytes, mime: str) -> bytes:
    """Decode raster image, resize to <=400px longest side, return WebP <=30KB.

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


DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

# Enough to tell one mandate from another at tile size; more would not be legible.
DOCX_PREVIEW_CHARS = 200
_W_T = re.compile(rb"<w:t[^>]*>(.*?)</w:t>", re.DOTALL)
_XML_TAG = re.compile(rb"<[^>]+>")
# The three that actually appear in Chilean contract text.
_ENTITIES = ((b"&amp;", b"&"), (b"&lt;", b"<"), (b"&gt;", b">"), (b"&quot;", b'"'))


def extract_docx_text(docx_bytes: bytes, limit: int = DOCX_PREVIEW_CHARS) -> str:
    """First `limit` characters of a .docx body, using only the stdlib.

    A .docx is a zip whose `word/document.xml` holds the runs of text in `<w:t>`
    elements. Pulling those out is a regex over one member, which costs a few
    milliseconds; the alternative (python-docx) is a dependency, and the real
    alternative (LibreOffice) is half a gigabyte in the API image.

    Returns "" when the file is not a readable docx — the caller treats that as
    "no preview" rather than an error.
    """
    try:
        with zipfile.ZipFile(io.BytesIO(docx_bytes)) as zf:
            xml = zf.read("word/document.xml")
    except (zipfile.BadZipFile, KeyError, OSError):
        return ""
    parts: list[bytes] = []
    total = 0
    for match in _W_T.finditer(xml):
        chunk = _XML_TAG.sub(b"", match.group(1))
        for token, char in _ENTITIES:
            chunk = chunk.replace(token, char)
        if not chunk:
            continue
        parts.append(chunk)
        total += len(chunk)
        if total >= limit * 2:
            break
    text = b" ".join(parts).decode("utf-8", errors="replace")
    text = " ".join(text.split())
    return text[:limit]


def _preview_font(size: int) -> ImageFont.ImageFont | ImageFont.FreeTypeFont:
    """A font that exists both on a developer's Mac and in python:3.12-slim.

    The slim image ships no system fonts at all, so the bundled bitmap font is
    the only guaranteed one; Pillow can scale it since 10.1.
    """
    for path in (
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ):
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    try:
        return ImageFont.load_default(size=size)
    except TypeError:  # Pillow < 10.1
        return ImageFont.load_default()


def _wrap(draw: ImageDraw.ImageDraw, text: str, font, max_width: int) -> list[str]:
    lines: list[str] = []
    line = ""
    for word in text.split(" "):
        candidate = f"{line} {word}".strip()
        if draw.textlength(candidate, font=font) <= max_width or not line:
            line = candidate
        else:
            lines.append(line)
            line = word
    if line:
        lines.append(line)
    return lines


def _split_heading(text: str, max_head: int = 52) -> tuple[str, str]:
    """Split the extracted text into a title-ish opening and the rest.

    Prefers a sentence break, then a run of capitals (contract headings are
    shouted), and otherwise just takes the first words.
    """
    for stop in (". ", " — ", ": "):
        idx = text.find(stop)
        if 0 < idx <= max_head:
            return text[:idx].strip(), text[idx + len(stop) :].strip()
    words = text.split(" ")
    head: list[str] = []
    for word in words:
        if head and len(" ".join(head + [word])) > max_head:
            break
        # A shouted heading ends where normal case begins.
        if head and word[:1].isupper() and not word.isupper() and head[-1].isupper():
            break
        head.append(word)
    if not head:
        head = words[:1]
    return " ".join(head), " ".join(words[len(head) :])


def generate_docx_card(docx_bytes: bytes) -> bytes:
    """A legible stand-in for a .docx first page.

    THIS IS NOT THE DOCUMENT'S FIRST PAGE, and it is not trying to be. Rendering
    a real one means a Word-compatible layout engine — LibreOffice — which is
    450-600MB in the image and a 3-8s warm-up paid by whichever user happens to
    hit a cold instance. So instead: the opening line or two of the body, drawn
    on a neutral card.

    A document whose page one is a letterhead image will show the text
    underneath it, and the layout is ours rather than Word's. That is an
    acceptable trade for the job this actually does, which is letting a broker
    tell which mandate a tile is without opening it.
    """
    width = int(TARGET_HEIGHT_PX * 0.72)  # roughly A4 proportions at tile size
    card = Image.new("RGB", (width, TARGET_HEIGHT_PX), (250, 250, 250))
    draw = ImageDraw.Draw(card)

    accent = (74, 96, 130)
    draw.rectangle([0, 0, width, 6], fill=accent)

    pad = 18
    draw.text((pad, 20), "DOCX", font=_preview_font(15), fill=accent)

    text = extract_docx_text(docx_bytes)
    if text:
        # The opening words carry almost all of the identifying information
        # ("CONTRATO DE ARRENDAMIENTO"), and at tile size they are the only part
        # still resolvable, so they get their own weight and size.
        head, body = _split_heading(text)
        y = 50
        head_font = _preview_font(19)
        for line in _wrap(draw, head, head_font, width - pad * 2)[:3]:
            draw.text((pad, y), line, font=head_font, fill=(38, 38, 44))
            y += 24
        y += 6
        font = _preview_font(13)
        for line in _wrap(draw, body, font, width - pad * 2):
            if y > TARGET_HEIGHT_PX - 24:
                break
            draw.text((pad, y), line, font=font, fill=(110, 110, 118))
            y += 19
    else:
        # Ruled lines: says "a document" without pretending to quote one.
        for i in range(14):
            y = 60 + i * 22
            draw.rectangle(
                [pad, y, pad + (width - pad * 2) * (0.55 if i % 5 == 4 else 0.92), y + 6],
                fill=(226, 226, 230),
            )

    return _encode_webp(card)


def thumbnail_path(tenant_id: str, document_id: str, version_number: int, ext: str = THUMBNAIL_EXT) -> str:
    """Storage path for a version's thumbnail.

    `ext` is a parameter rather than a constant because rows written before the
    WebP switch hold `.png` paths and must keep resolving.
    """
    return f"{tenant_id}/4_thumbnails/{document_id}/v{version_number}.{ext}"
