from unittest.mock import MagicMock, patch
from uuid import UUID, uuid4

import pytest

from app.features.users.schemas import UserCreate, UserUpdate
from app.features.users.service import UserService

MOCK_TENANT_ID = UUID("a1b2c3d4-e5f6-7890-abcd-ef1234567890")
MOCK_USER_ID = uuid4()

MOCK_USER = {
    "id": str(MOCK_USER_ID),
    "tenant_id": str(MOCK_TENANT_ID),
    "full_name": "Service Test User",
    "role": "AGENT",
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
    table_mock.ilike.return_value = table_mock
    table_mock.limit.return_value = table_mock
    table_mock.single.return_value = table_mock
    table_mock.execute.return_value = _mock_execute(execute_return)
    return table_mock


@pytest.mark.asyncio
@patch("app.features.users.service.get_supabase_client")
async def test_list_users(mock_client):
    table_mock = _build_table_mock([MOCK_USER])
    mock_client.return_value.table.return_value = table_mock

    result = await UserService.list_users(MOCK_TENANT_ID)

    assert len(result) == 1
    assert result[0]["full_name"] == "Service Test User"


@pytest.mark.asyncio
@patch("app.features.users.service.get_supabase_client")
async def test_get_user(mock_client):
    table_mock = _build_table_mock(MOCK_USER)
    mock_client.return_value.table.return_value = table_mock

    result = await UserService.get_user(MOCK_USER_ID, MOCK_TENANT_ID)

    assert result["id"] == str(MOCK_USER_ID)


@pytest.mark.asyncio
@patch("app.features.users.service.get_supabase_client")
async def test_get_me(mock_client):
    table_mock = _build_table_mock(MOCK_USER)
    mock_client.return_value.table.return_value = table_mock

    result = await UserService.get_me(MOCK_USER_ID)

    assert result["id"] == str(MOCK_USER_ID)
    assert result["full_name"] == "Service Test User"


@pytest.mark.asyncio
@patch("app.features.users.service.get_supabase_client")
async def test_create_user(mock_client):
    table_mock = _build_table_mock([MOCK_USER])
    # Uniqueness pre-check returns empty (no conflicts).
    table_mock.execute.return_value = _mock_execute([])
    mock_client.return_value.table.return_value = table_mock

    auth_user = MagicMock(id=str(MOCK_USER_ID))
    auth_resp = MagicMock(user=auth_user)
    mock_client.return_value.auth.admin.create_user.return_value = auth_resp

    # First execute() = uniqueness check (empty), subsequent = insert returns row.
    calls = {"n": 0}

    def execute_side_effect(*_a, **_k):
        calls["n"] += 1
        return _mock_execute([] if calls["n"] == 1 else [MOCK_USER])

    table_mock.execute.return_value = None
    table_mock.execute.side_effect = execute_side_effect

    payload = UserCreate(
        email="service@test.local",
        full_name="Service Test User",
        role="AGENT",
    )

    result = await UserService.create_user(payload, MOCK_TENANT_ID)

    assert result["full_name"] == "Service Test User"
    assert result["role"] == "AGENT"


@pytest.mark.asyncio
@patch("app.features.users.service.get_supabase_client")
async def test_update_user(mock_client):
    updated = {**MOCK_USER, "role": "BUYER"}
    table_mock = _build_table_mock([updated])
    mock_client.return_value.table.return_value = table_mock

    payload = UserUpdate(role="BUYER")

    result = await UserService.update_user(MOCK_USER_ID, payload, MOCK_TENANT_ID)

    assert result["role"] == "BUYER"


@pytest.mark.asyncio
@patch("app.features.users.service.get_supabase_client")
async def test_delete_user(mock_client):
    table_mock = _build_table_mock([])
    mock_client.return_value.table.return_value = table_mock

    await UserService.delete_user(MOCK_USER_ID, MOCK_TENANT_ID)

    mock_client.return_value.table.assert_called_with("profiles")
