import io

import pytest

from app.features.documents.metadata import extract_pdf_metadata, strip_pdf_metadata

pypdf = pytest.importorskip("pypdf")


def _make_pdf_with_metadata() -> bytes:
    writer = pypdf.PdfWriter()
    writer.add_blank_page(width=200, height=200)
    writer.add_metadata(
        {
            "/Producer": "MicrosoftWord-Internal",
            "/Author": "Some Person",
            "/Title": "Cotización Marzo (preview)",
            "/Subject": "internal review",
        }
    )
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


def test_extract_metadata_returns_metadata_and_page_count():
    pdf = _make_pdf_with_metadata()
    meta, pages = extract_pdf_metadata(pdf)
    assert pages == 1
    assert meta.get("Title") == "Cotización Marzo (preview)"
    assert meta.get("Author") == "Some Person"


def test_strip_metadata_replaces_identifying_fields():
    original = _make_pdf_with_metadata()
    stripped = strip_pdf_metadata(original)
    meta, _ = extract_pdf_metadata(stripped)
    assert meta.get("Producer") == "PropOS"
    assert meta.get("Creator") == "PropOS"
    assert meta.get("Author") in (None, "")
    assert meta.get("Title") in (None, "")


def test_extract_garbage_returns_empty():
    meta, pages = extract_pdf_metadata(b"not a pdf")
    assert meta == {}
    assert pages is None


def test_strip_garbage_passthrough():
    assert strip_pdf_metadata(b"not a pdf") == b"not a pdf"
