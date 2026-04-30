from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

USERS_PATH = "/api/v1/users"
MOCK_USER_ID = "11111111-1111-1111-1111-111111111111"
MOCK_OTHER_USER_ID = str(uuid4())
MOCK_TENANT_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"

MOCK_USER = {
    "id": MOCK_OTHER_USER_ID,
    "tenant_id": MOCK_TENANT_ID,
    "full_name": "John Agent",
    "role": "AGENT",
    "is_active": True,
    "created_at": "2024-01-01T00:00:00",
    "updated_at": "2024-01-01T00:00:00",
}

MOCK_ME = {
    "id": MOCK_USER_ID,
    "tenant_id": MOCK_TENANT_ID,
    "full_name": "Test Admin",
    "role": "ADMIN",
    "is_active": True,
    "created_at": "2024-01-01T00:00:00",
    "updated_at": "2024-01-01T00:00:00",
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


@pytest.mark.asyncio
@patch("app.features.users.service.get_supabase_client")
async def test_get_me(mock_client, client):
    table_mock = _build_table_mock(MOCK_ME)
    mock_client.return_value.table.return_value = table_mock

    response = await client.get(f"{USERS_PATH}/me")

    assert response.status_code == 200
    assert response.json()["id"] == MOCK_USER_ID
    assert response.json()["full_name"] == "Test Admin"


@pytest.mark.asyncio
@patch("app.features.users.service.get_supabase_client")
async def test_list_users(mock_client, client):
    table_mock = _build_table_mock([MOCK_USER])
    mock_client.return_value.table.return_value = table_mock

    response = await client.get(USERS_PATH)

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["full_name"] == "John Agent"


@pytest.mark.asyncio
@patch("app.features.users.service.get_supabase_client")
async def test_get_user(mock_client, client):
    table_mock = _build_table_mock(MOCK_USER)
    mock_client.return_value.table.return_value = table_mock

    response = await client.get(f"{USERS_PATH}/{MOCK_OTHER_USER_ID}")

    assert response.status_code == 200
    assert response.json()["id"] == MOCK_OTHER_USER_ID


@pytest.mark.asyncio
@patch("app.features.users.service.get_supabase_client")
async def test_create_user(mock_client, client):
    table_mock = _build_table_mock([MOCK_USER])
    mock_client.return_value.table.return_value = table_mock

    payload = {
        "full_name": "John Agent",
        "role": "AGENT",
        "is_active": True,
    }

    response = await client.post(USERS_PATH, json=payload)

    assert response.status_code == 201
    assert response.json()["full_name"] == "John Agent"
    assert response.json()["role"] == "AGENT"


@pytest.mark.asyncio
@patch("app.features.users.service.get_supabase_client")
async def test_update_user(mock_client, client):
    updated_user = {**MOCK_USER, "role": "BUYER"}
    table_mock = _build_table_mock([updated_user])
    mock_client.return_value.table.return_value = table_mock

    payload = {"role": "BUYER"}

    response = await client.patch(
        f"{USERS_PATH}/{MOCK_OTHER_USER_ID}", json=payload
    )

    assert response.status_code == 200
    assert response.json()["role"] == "BUYER"


@pytest.mark.asyncio
@patch("app.features.users.service.get_supabase_client")
async def test_delete_user(mock_client, client):
    table_mock = _build_table_mock([])
    mock_client.return_value.table.return_value = table_mock

    response = await client.delete(f"{USERS_PATH}/{MOCK_OTHER_USER_ID}")

    assert response.status_code == 204
