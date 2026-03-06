"""Tests for document storage helpers (Supabase Storage)."""

from unittest.mock import MagicMock, patch

from app.features.documents.storage import delete_file, get_file_url, upload_file


@patch("app.features.documents.storage.get_supabase_client")
def test_upload_file(mock_client):
    mock_storage = MagicMock()
    mock_storage.upload.return_value = {"Key": "documents/test.pdf"}
    mock_client.return_value.storage.from_.return_value = mock_storage

    result = upload_file("test.pdf", b"content", "application/pdf")

    assert result["Key"] == "documents/test.pdf"
    mock_client.return_value.storage.from_.assert_called_with("documents")
    mock_storage.upload.assert_called_once_with(
        path="test.pdf",
        file=b"content",
        file_options={"content-type": "application/pdf"},
    )


@patch("app.features.documents.storage.get_supabase_client")
def test_get_file_url(mock_client):
    mock_storage = MagicMock()
    mock_storage.create_signed_url.return_value = {
        "signedURL": "https://storage.example.com/signed/test.pdf"
    }
    mock_client.return_value.storage.from_.return_value = mock_storage

    result = get_file_url("test.pdf")

    assert result == "https://storage.example.com/signed/test.pdf"
    mock_storage.create_signed_url.assert_called_once_with(
        path="test.pdf", expires_in=3600
    )


@patch("app.features.documents.storage.get_supabase_client")
def test_delete_file(mock_client):
    mock_storage = MagicMock()
    mock_client.return_value.storage.from_.return_value = mock_storage

    delete_file("test.pdf")

    mock_storage.remove.assert_called_once_with(["test.pdf"])
