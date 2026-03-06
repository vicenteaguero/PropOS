from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

CONTACTS_PATH = "/api/contacts"
MOCK_CONTACT_ID = str(uuid4())
MOCK_TENANT_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"

MOCK_CONTACT = {
    "id": MOCK_CONTACT_ID,
    "tenant_id": MOCK_TENANT_ID,
    "full_name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "type": "BUYER",
    "metadata": None,
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
@patch("app.features.contacts.service.get_supabase_client")
async def test_list_contacts(mock_client, client):
    table_mock = _build_table_mock([MOCK_CONTACT])
    mock_client.return_value.table.return_value = table_mock

    response = await client.get(CONTACTS_PATH)

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["full_name"] == "John Doe"


@pytest.mark.asyncio
@patch("app.features.contacts.service.get_supabase_client")
async def test_get_contact(mock_client, client):
    table_mock = _build_table_mock(MOCK_CONTACT)
    mock_client.return_value.table.return_value = table_mock

    response = await client.get(f"{CONTACTS_PATH}/{MOCK_CONTACT_ID}")

    assert response.status_code == 200
    assert response.json()["id"] == MOCK_CONTACT_ID


@pytest.mark.asyncio
@patch("app.features.contacts.service.get_supabase_client")
async def test_create_contact(mock_client, client):
    table_mock = _build_table_mock([MOCK_CONTACT])
    mock_client.return_value.table.return_value = table_mock

    payload = {
        "full_name": "John Doe",
        "email": "john@example.com",
        "phone": "+1234567890",
        "type": "BUYER",
    }

    response = await client.post(CONTACTS_PATH, json=payload)

    assert response.status_code == 201
    assert response.json()["full_name"] == "John Doe"


@pytest.mark.asyncio
@patch("app.features.contacts.service.get_supabase_client")
async def test_update_contact(mock_client, client):
    updated_contact = {
        **MOCK_CONTACT,
        "full_name": "Jane Doe",
    }
    table_mock = _build_table_mock([updated_contact])
    mock_client.return_value.table.return_value = table_mock

    payload = {"full_name": "Jane Doe"}

    response = await client.patch(f"{CONTACTS_PATH}/{MOCK_CONTACT_ID}", json=payload)

    assert response.status_code == 200
    assert response.json()["full_name"] == "Jane Doe"


@pytest.mark.asyncio
@patch("app.features.contacts.service.get_supabase_client")
async def test_delete_contact(mock_client, client):
    table_mock = _build_table_mock([])
    mock_client.return_value.table.return_value = table_mock

    response = await client.delete(f"{CONTACTS_PATH}/{MOCK_CONTACT_ID}")

    assert response.status_code == 204
