"""Tests for auth dependencies (real get_current_user flow)."""

from unittest.mock import MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import create_app


@pytest.fixture
def raw_app():
    """App without dependency overrides — uses real auth flow."""
    return create_app()


@pytest.fixture
async def raw_client(raw_app):
    transport = ASGITransport(app=raw_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
@patch("app.features.users.service.get_supabase_client")
@patch("app.core.dependencies.get_user_profile")
@patch("app.core.dependencies.verify_token")
async def test_valid_token_returns_user(mock_verify, mock_profile, mock_svc_client, raw_client):
    mock_user = MagicMock()
    mock_user.id = "11111111-1111-1111-1111-111111111111"
    mock_verify.return_value = mock_user
    mock_profile.return_value = {
        "id": "11111111-1111-1111-1111-111111111111",
        "role": "ADMIN",
        "tenant_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "full_name": "Test Admin",
    }

    # Mock the UserService.get_me supabase call
    me_data = {
        "id": "11111111-1111-1111-1111-111111111111",
        "tenant_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "full_name": "Test Admin",
        "role": "ADMIN",
        "is_active": True,
        "created_at": "2024-01-01T00:00:00",
        "updated_at": "2024-01-01T00:00:00",
    }
    mock_response = MagicMock()
    mock_response.data = me_data
    table_mock = MagicMock()
    table_mock.select.return_value = table_mock
    table_mock.eq.return_value = table_mock
    table_mock.single.return_value = table_mock
    table_mock.execute.return_value = mock_response
    mock_svc_client.return_value.table.return_value = table_mock

    response = await raw_client.get(
        "/api/users/me",
        headers={"Authorization": "Bearer fake-valid-token"},
    )

    assert response.status_code == 200
    assert response.json()["full_name"] == "Test Admin"
    mock_verify.assert_called_once_with("fake-valid-token")
    mock_profile.assert_called_once_with("11111111-1111-1111-1111-111111111111")


@pytest.mark.asyncio
@patch("app.core.dependencies.verify_token")
async def test_invalid_token_returns_401(mock_verify, raw_client):
    mock_verify.side_effect = Exception("Invalid token")

    response = await raw_client.get(
        "/api/users/me",
        headers={"Authorization": "Bearer bad-token"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid or expired token"


@pytest.mark.asyncio
@patch("app.core.dependencies.get_user_profile")
@patch("app.core.dependencies.verify_token")
async def test_no_profile_returns_401(mock_verify, mock_profile, raw_client):
    mock_user = MagicMock()
    mock_user.id = "11111111-1111-1111-1111-111111111111"
    mock_verify.return_value = mock_user
    mock_profile.return_value = None

    response = await raw_client.get(
        "/api/users/me",
        headers={"Authorization": "Bearer valid-but-no-profile"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid or expired token"


@pytest.mark.asyncio
async def test_missing_token_returns_403(raw_client):
    response = await raw_client.get("/api/users/me")

    assert response.status_code == 403
