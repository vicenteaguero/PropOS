"""Tests for supabase auth helpers."""

from unittest.mock import MagicMock, patch

from app.core.supabase.auth import get_user_profile, verify_token


@patch("app.core.supabase.auth.get_supabase_client")
def test_verify_token(mock_client):
    mock_user = MagicMock()
    mock_user.id = "11111111-1111-1111-1111-111111111111"
    mock_response = MagicMock()
    mock_response.user = mock_user
    mock_client.return_value.auth.get_user.return_value = mock_response

    result = verify_token("test-token")

    assert result.id == "11111111-1111-1111-1111-111111111111"
    mock_client.return_value.auth.get_user.assert_called_once_with("test-token")


@patch("app.core.supabase.auth.get_supabase_client")
def test_get_user_profile(mock_client):
    mock_data = {
        "id": "11111111-1111-1111-1111-111111111111",
        "role": "ADMIN",
        "tenant_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    }
    mock_response = MagicMock()
    mock_response.data = mock_data
    table_mock = MagicMock()
    table_mock.select.return_value = table_mock
    table_mock.eq.return_value = table_mock
    table_mock.single.return_value = table_mock
    table_mock.execute.return_value = mock_response
    mock_client.return_value.table.return_value = table_mock

    result = get_user_profile("11111111-1111-1111-1111-111111111111")

    assert result["role"] == "ADMIN"


@patch("app.core.supabase.auth.get_supabase_client")
def test_get_user_profile_with_client(mock_get_client):
    """Test passing an explicit client skips get_supabase_client."""
    mock_data = {"id": "test", "role": "AGENT"}
    mock_response = MagicMock()
    mock_response.data = mock_data
    explicit_client = MagicMock()
    table_mock = MagicMock()
    table_mock.select.return_value = table_mock
    table_mock.eq.return_value = table_mock
    table_mock.single.return_value = table_mock
    table_mock.execute.return_value = mock_response
    explicit_client.table.return_value = table_mock

    result = get_user_profile("test", client=explicit_client)

    assert result["role"] == "AGENT"
    mock_get_client.assert_not_called()
