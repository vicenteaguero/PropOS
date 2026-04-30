from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.features.documents.validation import (
    ALLOWED_MIME,
    detect_mime,
    kind_from_mime,
    validate_upload,
)


class TestDetectMime:
    def test_pdf(self):
        assert detect_mime(b"%PDF-1.4\nrest of file") == "application/pdf"

    def test_jpeg(self):
        assert detect_mime(b"\xff\xd8\xff\xe0") == "image/jpeg"

    def test_png(self):
        assert detect_mime(b"\x89PNG\r\n\x1a\nrest") == "image/png"

    def test_webp_valid(self):
        # RIFF + 4 bytes size + WEBP signature
        assert detect_mime(b"RIFF\x00\x00\x00\x00WEBP") == "image/webp"

    def test_webp_invalid_riff(self):
        # RIFF without WEBP marker → falls through to next match (DOCX/zip would not match RIFF)
        assert detect_mime(b"RIFF\x00\x00\x00\x00WAVE") is None

    def test_docx(self):
        # PK\x03\x04 zip header — treated as DOCX in this whitelist
        assert detect_mime(b"PK\x03\x04rest") == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

    def test_unknown(self):
        assert detect_mime(b"random garbage bytes here") is None

    def test_empty(self):
        assert detect_mime(b"") is None


class TestValidateUpload:
    def test_valid_pdf(self):
        mime = validate_upload(b"%PDF-1.4\nfoo")
        assert mime == "application/pdf"

    def test_empty_rejected(self):
        with pytest.raises(HTTPException) as exc:
            validate_upload(b"")
        assert exc.value.status_code == 400

    def test_too_large(self):
        big = b"%PDF-" + b"x" * (51 * 1024 * 1024)
        with pytest.raises(HTTPException) as exc:
            validate_upload(big)
        assert exc.value.status_code == 413

    def test_unsupported_extension_rejected(self):
        # .exe-like header
        with pytest.raises(HTTPException) as exc:
            validate_upload(b"MZ\x90\x00fake exe")
        assert exc.value.status_code == 415

    def test_custom_size_cap(self):
        with pytest.raises(HTTPException) as exc:
            validate_upload(b"%PDF-" + b"x" * 1000, max_bytes=500)
        assert exc.value.status_code == 413

    def test_declared_mime_outside_whitelist_rejected(self):
        with pytest.raises(HTTPException) as exc:
            validate_upload(b"%PDF-content", declared_mime="application/x-msdownload")
        assert exc.value.status_code == 415


class TestKindFromMime:
    def test_pdf(self):
        assert kind_from_mime("application/pdf") == "PDF"

    def test_docx(self):
        assert (
            kind_from_mime(
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            )
            == "DOCX"
        )

    def test_image(self):
        assert kind_from_mime("image/jpeg") == "IMAGE_PDF"
        assert kind_from_mime("image/png") == "IMAGE_PDF"
        assert kind_from_mime("image/webp") == "IMAGE_PDF"

    def test_other(self):
        assert kind_from_mime("application/octet-stream") == "OTHER"


def test_allowed_mime_contents():
    assert "application/pdf" in ALLOWED_MIME
    assert "application/x-msdownload" not in ALLOWED_MIME
    assert "application/javascript" not in ALLOWED_MIME
