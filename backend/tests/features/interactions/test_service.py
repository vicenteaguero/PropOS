from unittest.mock import MagicMock, patch
from uuid import UUID, uuid4

import pytest

from app.features.interactions.schemas import InteractionCreate, InteractionUpdate
from app.features.interactions.service import InteractionService

MOCK_TENANT_ID = UUID("a1b2c3d4-e5f6-7890-abcd-ef1234567890")
MOCK_INTERACTION_ID = uuid4()
MOCK_USER_ID = uuid4()
MOCK_CONTACT_ID = uuid4()
MOCK_PROPERTY_ID = uuid4()

MOCK_INTERACTION = {
    "id": str(MOCK_INTERACTION_ID),
    "tenant_id": str(MOCK_TENANT_ID),
    "notes": "Service test interaction",
    "user_id": str(MOCK_USER_ID),
    "contact_id": str(MOCK_CONTACT_ID),
    "property_id": str(MOCK_PROPERTY_ID),
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
async def test_list_interactions(mock_client):
    table_mock = _build_table_mock([MOCK_INTERACTION])
    mock_client.return_value.table.return_value = table_mock

    result = await InteractionService.list_interactions(MOCK_TENANT_ID)

    assert len(result) == 1
    assert result[0]["notes"] == "Service test interaction"


@pytest.mark.asyncio
@patch("app.features.interactions.service.get_supabase_client")
async def test_get_interaction(mock_client):
    table_mock = _build_table_mock(MOCK_INTERACTION)
    mock_client.return_value.table.return_value = table_mock

    result = await InteractionService.get_interaction(
        MOCK_INTERACTION_ID, MOCK_TENANT_ID
    )

    assert result["id"] == str(MOCK_INTERACTION_ID)


@pytest.mark.asyncio
@patch("app.features.interactions.service.get_supabase_client")
async def test_create_interaction(mock_client):
    table_mock = _build_table_mock([MOCK_INTERACTION])
    mock_client.return_value.table.return_value = table_mock

    payload = InteractionCreate(
        notes="Service test interaction",
        user_id=MOCK_USER_ID,
        contact_id=MOCK_CONTACT_ID,
        property_id=MOCK_PROPERTY_ID,
    )

    result = await InteractionService.create_interaction(payload, MOCK_TENANT_ID)

    assert result["notes"] == "Service test interaction"


@pytest.mark.asyncio
@patch("app.features.interactions.service.get_supabase_client")
async def test_update_interaction(mock_client):
    updated = {**MOCK_INTERACTION, "notes": "Updated notes"}
    table_mock = _build_table_mock([updated])
    mock_client.return_value.table.return_value = table_mock

    payload = InteractionUpdate(notes="Updated notes")

    result = await InteractionService.update_interaction(
        MOCK_INTERACTION_ID, payload, MOCK_TENANT_ID
    )

    assert result["notes"] == "Updated notes"


@pytest.mark.asyncio
@patch("app.features.interactions.service.get_supabase_client")
async def test_update_interaction_with_uuid_fields(mock_client):
    new_contact_id = uuid4()
    updated = {**MOCK_INTERACTION, "contact_id": str(new_contact_id)}
    table_mock = _build_table_mock([updated])
    mock_client.return_value.table.return_value = table_mock

    payload = InteractionUpdate(contact_id=new_contact_id)

    result = await InteractionService.update_interaction(
        MOCK_INTERACTION_ID, payload, MOCK_TENANT_ID
    )

    assert result["contact_id"] == str(new_contact_id)


@pytest.mark.asyncio
@patch("app.features.interactions.service.get_supabase_client")
async def test_delete_interaction(mock_client):
    table_mock = _build_table_mock([])
    mock_client.return_value.table.return_value = table_mock

    await InteractionService.delete_interaction(MOCK_INTERACTION_ID, MOCK_TENANT_ID)

    mock_client.return_value.table.assert_called_with("interactions")
