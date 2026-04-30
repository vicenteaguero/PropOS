"""Tests for role-based access control across endpoints."""

from unittest.mock import MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.dependencies import get_current_user
from app.main import create_app

TENANT_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
USER_ID = "11111111-1111-1111-1111-111111111111"


def _make_user(role: str) -> dict:
    return {
        "id": USER_ID,
        "role": role,
        "tenant_id": TENANT_ID,
        "full_name": f"Test {role.title()}",
    }


def _mock_execute(data):
    mock_response = MagicMock()
    mock_response.data = data
    return mock_response


def _build_table_mock(execute_return):
    table_mock = MagicMock()
    table_mock.select.return_value = table_mock
    table_mock.insert.return_value = table_mock
    table_mock.update.return_value = table_mock
    table_mock.delete.return_value = table_mock
    table_mock.eq.return_value = table_mock
    table_mock.single.return_value = table_mock
    table_mock.execute.return_value = _mock_execute(execute_return)
    return table_mock


async def _client_for_role(role: str) -> AsyncClient:
    user = _make_user(role)
    application = create_app()
    application.dependency_overrides[get_current_user] = lambda: user
    transport = ASGITransport(app=application)
    return AsyncClient(transport=transport, base_url="http://test")


# --- AGENT can create/read ---


@pytest.mark.asyncio
@patch("app.features.properties.service.get_supabase_client")
async def test_agent_can_create_property(mock_client):
    mock_property = {
        "id": "00000000-0000-0000-0000-000000000001",
        "tenant_id": TENANT_ID,
        "title": "Agent Property",
        "description": None,
        "status": "AVAILABLE",
        "address": None,
        "surface_m2": None,
        "landowner_id": None,
        "created_at": "2024-01-01T00:00:00",
        "updated_at": "2024-01-01T00:00:00",
    }
    table_mock = _build_table_mock([mock_property])
    mock_client.return_value.table.return_value = table_mock

    client = await _client_for_role("AGENT")
    async with client:
        response = await client.post(
            "/api/properties", json={"title": "Agent Property"}
        )
        assert response.status_code == 201


@pytest.mark.asyncio
@patch("app.features.properties.service.get_supabase_client")
async def test_agent_can_list_properties(mock_client):
    table_mock = _build_table_mock([])
    mock_client.return_value.table.return_value = table_mock

    client = await _client_for_role("AGENT")
    async with client:
        response = await client.get("/api/properties")
        assert response.status_code == 200


@pytest.mark.asyncio
@patch("app.features.contacts.service.get_supabase_client")
async def test_agent_can_list_contacts(mock_client):
    table_mock = _build_table_mock([])
    mock_client.return_value.table.return_value = table_mock

    client = await _client_for_role("AGENT")
    async with client:
        response = await client.get("/api/contacts")
        assert response.status_code == 200


# --- ADMIN can delete ---


@pytest.mark.asyncio
@patch("app.features.properties.service.get_supabase_client")
async def test_admin_can_delete_property(mock_client):
    table_mock = _build_table_mock([])
    mock_client.return_value.table.return_value = table_mock

    client = await _client_for_role("ADMIN")
    async with client:
        response = await client.delete(
            "/api/properties/00000000-0000-0000-0000-000000000001"
        )
        assert response.status_code == 204


# --- Non-ADMIN cannot access user management ---


@pytest.mark.asyncio
async def test_agent_cannot_list_users():
    client = await _client_for_role("AGENT")
    async with client:
        response = await client.get("/api/users")
        assert response.status_code == 403


@pytest.mark.asyncio
async def test_buyer_cannot_list_users():
    client = await _client_for_role("BUYER")
    async with client:
        response = await client.get("/api/users")
        assert response.status_code == 403


@pytest.mark.asyncio
async def test_landowner_cannot_create_user():
    client = await _client_for_role("LANDOWNER")
    async with client:
        response = await client.post(
            "/api/users", json={"full_name": "Nope", "role": "AGENT"}
        )
        assert response.status_code == 403


@pytest.mark.asyncio
async def test_content_cannot_delete_user():
    client = await _client_for_role("CONTENT")
    async with client:
        response = await client.delete(
            "/api/users/00000000-0000-0000-0000-000000000001"
        )
        assert response.status_code == 403


# --- Notifications role checks ---


@pytest.mark.asyncio
async def test_buyer_cannot_send_notification():
    client = await _client_for_role("BUYER")
    async with client:
        response = await client.post(
            "/api/notifications/send", json={"body": "test"}
        )
        assert response.status_code == 403


@pytest.mark.asyncio
async def test_agent_cannot_send_notification():
    client = await _client_for_role("AGENT")
    async with client:
        response = await client.post(
            "/api/notifications/send", json={"body": "test"}
        )
        assert response.status_code == 403
