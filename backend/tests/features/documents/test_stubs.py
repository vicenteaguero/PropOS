from app.features.documents.stubs.ai import analyze_document
from app.features.documents.stubs.docx_to_pdf import docx_to_pdf
from app.features.documents.stubs.ocr import ocr_pdf
from app.features.documents.stubs.scan import scan_file
from app.features.documents.stubs.scrape import scrape_url
from app.features.documents.stubs.sign import sign_document
from app.features.documents.stubs.translate import translate_pdf


def test_scan_returns_skipped_v1():
    # V1 stub no hace scan real → marca skipped (no clean) para no falsificar seguridad
    assert scan_file(b"any") == "skipped"


def test_ocr_stub():
    result = ocr_pdf("path/x.pdf")
    assert result.plugin == "ocr"
    assert result.status == "not_implemented"


def test_ai_stub():
    result = analyze_document("path/x.pdf")
    assert result.plugin == "ai_vision"


def test_docx_to_pdf_stub():
    result = docx_to_pdf("path/x.docx")
    assert result.plugin == "docx_to_pdf"


def test_sign_stub():
    result = sign_document("path/x.pdf", "a@b.cl")
    assert result.plugin == "sign"


def test_scrape_stub():
    result = scrape_url("https://example.com/x.pdf")
    assert result.plugin == "scrape"


def test_translate_stub():
    result = translate_pdf("path/x.pdf", "en")
    assert result.plugin == "translate"
