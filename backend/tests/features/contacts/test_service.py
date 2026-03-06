from unittest.mock import MagicMock, patch
from uuid import UUID, uuid4

import pytest

from app.features.contacts.schemas import (
    ContactCreate,
    ContactUpdate,
)
from app.features.contacts.service import ContactService

MOCK_TENANT_ID = UUID("a1b2c3d4-e5f6-7890-abcd-ef1234567890")
MOCK_CONTACT_ID = uuid4()

MOCK_CONTACT = {
    "id": str(MOCK_CONTACT_ID),
    "tenant_id": str(MOCK_TENANT_ID),
    "full_name": "Service Test Contact",
    "email": "test@example.com",
    "phone": None,
    "type": "buyer",
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
async def test_list_contacts(mock_client):
    table_mock = _build_table_mock([MOCK_CONTACT])
    mock_client.return_value.table.return_value = table_mock

    result = await ContactService.list_contacts(MOCK_TENANT_ID)

    assert len(result) == 1
    assert result[0]["full_name"] == "Service Test Contact"


@pytest.mark.asyncio
@patch("app.features.contacts.service.get_supabase_client")
async def test_get_contact(mock_client):
    table_mock = _build_table_mock(MOCK_CONTACT)
    mock_client.return_value.table.return_value = table_mock

    result = await ContactService.get_contact(MOCK_CONTACT_ID, MOCK_TENANT_ID)

    assert result["id"] == str(MOCK_CONTACT_ID)


@pytest.mark.asyncio
@patch("app.features.contacts.service.get_supabase_client")
async def test_create_contact(mock_client):
    table_mock = _build_table_mock([MOCK_CONTACT])
    mock_client.return_value.table.return_value = table_mock

    payload = ContactCreate(
        full_name="Service Test Contact",
        email="test@example.com",
    )

    result = await ContactService.create_contact(payload, MOCK_TENANT_ID)

    assert result["full_name"] == "Service Test Contact"


@pytest.mark.asyncio
@patch("app.features.contacts.service.get_supabase_client")
async def test_update_contact(mock_client):
    updated = {
        **MOCK_CONTACT,
        "full_name": "Updated Name",
    }
    table_mock = _build_table_mock([updated])
    mock_client.return_value.table.return_value = table_mock

    payload = ContactUpdate(full_name="Updated Name")

    result = await ContactService.update_contact(
        MOCK_CONTACT_ID, payload, MOCK_TENANT_ID
    )

    assert result["full_name"] == "Updated Name"


@pytest.mark.asyncio
@patch("app.features.contacts.service.get_supabase_client")
async def test_delete_contact(mock_client):
    table_mock = _build_table_mock([])
    mock_client.return_value.table.return_value = table_mock

    await ContactService.delete_contact(MOCK_CONTACT_ID, MOCK_TENANT_ID)

    mock_client.return_value.table.assert_called_with("contacts")
