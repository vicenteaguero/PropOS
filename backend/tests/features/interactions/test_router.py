from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

INTERACTIONS_PATH = "/api/interactions"
MOCK_INTERACTION_ID = str(uuid4())
MOCK_TENANT_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
MOCK_USER_ID = str(uuid4())
MOCK_CONTACT_ID = str(uuid4())
MOCK_PROPERTY_ID = str(uuid4())

MOCK_INTERACTION = {
    "id": MOCK_INTERACTION_ID,
    "tenant_id": MOCK_TENANT_ID,
    "notes": "Initial meeting with buyer",
    "user_id": MOCK_USER_ID,
    "contact_id": MOCK_CONTACT_ID,
    "property_id": MOCK_PROPERTY_ID,
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
@patch("app.features.interactions.service.get_supabase_client")
async def test_list_interactions(mock_client, client):
    table_mock = _build_table_mock([MOCK_INTERACTION])
    mock_client.return_value.table.return_value = table_mock

    response = await client.get(INTERACTIONS_PATH)

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["notes"] == "Initial meeting with buyer"


@pytest.mark.asyncio
@patch("app.features.interactions.service.get_supabase_client")
async def test_get_interaction(mock_client, client):
    table_mock = _build_table_mock(MOCK_INTERACTION)
    mock_client.return_value.table.return_value = table_mock

    response = await client.get(f"{INTERACTIONS_PATH}/{MOCK_INTERACTION_ID}")

    assert response.status_code == 200
    assert response.json()["id"] == MOCK_INTERACTION_ID


@pytest.mark.asyncio
@patch("app.features.interactions.service.get_supabase_client")
async def test_create_interaction(mock_client, client):
    table_mock = _build_table_mock([MOCK_INTERACTION])
    mock_client.return_value.table.return_value = table_mock

    payload = {
        "notes": "Initial meeting with buyer",
        "user_id": MOCK_USER_ID,
        "contact_id": MOCK_CONTACT_ID,
        "property_id": MOCK_PROPERTY_ID,
    }

    response = await client.post(INTERACTIONS_PATH, json=payload)

    assert response.status_code == 201
    assert response.json()["notes"] == "Initial meeting with buyer"


@pytest.mark.asyncio
@patch("app.features.interactions.service.get_supabase_client")
async def test_update_interaction(mock_client, client):
    updated_interaction = {
        **MOCK_INTERACTION,
        "notes": "Follow-up call completed",
    }
    table_mock = _build_table_mock([updated_interaction])
    mock_client.return_value.table.return_value = table_mock

    payload = {"notes": "Follow-up call completed"}

    response = await client.patch(
        f"{INTERACTIONS_PATH}/{MOCK_INTERACTION_ID}", json=payload
    )

    assert response.status_code == 200
    assert response.json()["notes"] == "Follow-up call completed"


@pytest.mark.asyncio
@patch("app.features.interactions.service.get_supabase_client")
async def test_delete_interaction(mock_client, client):
    table_mock = _build_table_mock([])
    mock_client.return_value.table.return_value = table_mock

    response = await client.delete(f"{INTERACTIONS_PATH}/{MOCK_INTERACTION_ID}")

    assert response.status_code == 204
