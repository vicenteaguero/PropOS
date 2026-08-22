"""Thumbnails are the "proxy preview" the documents grid and list are built on.

Two properties matter and neither is obvious from reading the code: the bytes
really are WebP (an <img> gets whatever we uploaded, and the stored mime is
declared separately from the encoder), and they stay under the byte cap, which
is the entire reason the feature is worth having on a phone.
"""

import io

from PIL import Image

from app.features.documents.thumbnails import (
    MAX_OUTPUT_BYTES,
    TARGET_HEIGHT_PX,
    THUMBNAIL_EXT,
    generate_first_page_png,
    generate_image_thumbnail,
    thumbnail_path,
)


def _photo(width: int = 2400, height: int = 1600) -> Image.Image:
    """A noisy gradient — a flat fill would compress to nothing and prove little."""
    img = Image.new("RGB", (width, height))
    px = img.load()
    assert px is not None
    for y in range(0, height, 4):
        for x in range(0, width, 4):
            colour = ((x * 7) % 256, (y * 13) % 256, ((x + y) * 3) % 256)
            for dy in range(4):
                for dx in range(4):
                    if x + dx < width and y + dy < height:
                        px[x + dx, y + dy] = colour
    return img


def _as(fmt: str, img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return buf.getvalue()


def test_image_thumbnail_is_webp() -> None:
    out = generate_image_thumbnail(_as("JPEG", _photo()), "image/jpeg")
    assert Image.open(io.BytesIO(out)).format == "WEBP"


def test_image_thumbnail_respects_the_byte_cap() -> None:
    out = generate_image_thumbnail(_as("JPEG", _photo()), "image/jpeg")
    assert len(out) <= MAX_OUTPUT_BYTES


def test_image_thumbnail_fits_the_target_box() -> None:
    out = generate_image_thumbnail(_as("PNG", _photo(1200, 900)), "image/png")
    decoded = Image.open(io.BytesIO(out))
    assert max(decoded.width, decoded.height) <= TARGET_HEIGHT_PX


def test_small_image_is_not_upscaled() -> None:
    out = generate_image_thumbnail(_as("PNG", _photo(80, 60)), "image/png")
    decoded = Image.open(io.BytesIO(out))
    assert (decoded.width, decoded.height) == (80, 60)


def test_pdf_first_page_is_webp_within_cap() -> None:
    pdf = _as("PDF", _photo(1200, 1600))
    out = generate_first_page_png(pdf)
    decoded = Image.open(io.BytesIO(out))
    assert decoded.format == "WEBP"
    assert decoded.height == TARGET_HEIGHT_PX
    assert len(out) <= MAX_OUTPUT_BYTES


def test_thumbnail_path_defaults_to_webp() -> None:
    assert thumbnail_path("t", "d", 3) == "t/4_thumbnails/d/v3.webp"
    assert THUMBNAIL_EXT == "webp"


def test_thumbnail_path_still_addresses_legacy_png_rows() -> None:
    """Paths written before the switch are stored strings and must keep resolving."""
    assert thumbnail_path("t", "d", 1, "png") == "t/4_thumbnails/d/v1.png"
