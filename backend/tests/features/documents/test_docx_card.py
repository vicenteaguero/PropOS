"""The .docx stand-in preview.

The contract this has to keep is narrow but real: never raise (it runs inside a
best-effort upload path), always produce a valid WebP under the byte cap, and
put the identifying opening words where they survive being scaled down to a
grid tile.
"""

import io
import zipfile

from PIL import Image

from app.features.documents.thumbnails import (
    MAX_OUTPUT_BYTES,
    TARGET_HEIGHT_PX,
    _split_heading,
    extract_docx_text,
    generate_docx_card,
)


def _docx(*paragraphs: str, member: str = "word/document.xml") -> bytes:
    body = "".join(f"<w:p><w:r><w:t>{p}</w:t></w:r></w:p>" for p in paragraphs)
    xml = f'<?xml version="1.0"?><w:document xmlns:w="x"><w:body>{body}</w:body></w:document>'
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr(member, xml)
    return buf.getvalue()


def test_extracts_body_text() -> None:
    got = extract_docx_text(_docx("CONTRATO", "En Santiago de Chile"))
    assert got == "CONTRATO En Santiago de Chile"


def test_extraction_is_length_capped() -> None:
    assert len(extract_docx_text(_docx("palabra " * 500), limit=40)) == 40


def test_extraction_decodes_xml_entities() -> None:
    assert extract_docx_text(_docx("Perez &amp; Gonzalez")) == "Perez & Gonzalez"


def test_extraction_handles_accented_text() -> None:
    assert "Martínez" in extract_docx_text(_docx("Señor Martínez"))


def test_extraction_of_a_non_docx_returns_empty() -> None:
    """A mislabelled upload must not raise inside the upload path."""
    assert extract_docx_text(b"this is not a zip") == ""


def test_extraction_of_a_zip_without_document_xml() -> None:
    assert extract_docx_text(_docx("hi", member="word/other.xml")) == ""


def test_card_is_a_webp_within_the_cap() -> None:
    out = generate_docx_card(_docx("CONTRATO DE ARRENDAMIENTO", "En Santiago de Chile, a 22"))
    img = Image.open(io.BytesIO(out))
    assert img.format == "WEBP"
    assert img.height == TARGET_HEIGHT_PX
    assert len(out) <= MAX_OUTPUT_BYTES


def test_card_renders_for_an_unreadable_docx() -> None:
    """Falls back to ruled lines rather than failing the upload."""
    out = generate_docx_card(b"garbage")
    assert Image.open(io.BytesIO(out)).format == "WEBP"


def test_card_renders_for_an_empty_document() -> None:
    assert len(generate_docx_card(_docx())) > 0


def test_heading_split_on_a_shouted_title() -> None:
    head, body = _split_heading("CONTRATO DE ARRENDAMIENTO En Santiago de Chile a 22")
    assert head == "CONTRATO DE ARRENDAMIENTO"
    assert body.startswith("En Santiago")


def test_heading_split_on_a_sentence_break() -> None:
    head, body = _split_heading("Mandato de venta. Por el presente instrumento")
    assert head == "Mandato de venta"
    assert body == "Por el presente instrumento"


def test_heading_split_never_returns_an_empty_head() -> None:
    head, _ = _split_heading("Unaunicapalabramuylargaquenocabeenelencabezado")
    assert head
