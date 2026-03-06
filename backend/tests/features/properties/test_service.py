from unittest.mock import MagicMock, patch
from uuid import UUID, uuid4

import pytest

from app.features.properties.schemas import (
    PropertyCreate,
    PropertyUpdate,
)
from app.features.properties.service import PropertyService

MOCK_TENANT_ID = UUID("a1b2c3d4-e5f6-7890-abcd-ef1234567890")
MOCK_PROPERTY_ID = uuid4()

MOCK_PROPERTY = {
    "id": str(MOCK_PROPERTY_ID),
    "tenant_id": str(MOCK_TENANT_ID),
    "title": "Service Test Property",
    "description": None,
    "status": "AVAILABLE",
    "address": None,
    "surface_m2": None,
    "landowner_id": None,
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
@patch("app.features.properties.service.get_supabase_client")
async def test_list_properties(mock_client):
    table_mock = _build_table_mock([MOCK_PROPERTY])
    mock_client.return_value.table.return_value = table_mock

    result = await PropertyService.list_properties(MOCK_TENANT_ID)

    assert len(result) == 1
    assert result[0]["title"] == "Service Test Property"


@pytest.mark.asyncio
@patch("app.features.properties.service.get_supabase_client")
async def test_get_property(mock_client):
    table_mock = _build_table_mock(MOCK_PROPERTY)
    mock_client.return_value.table.return_value = table_mock

    result = await PropertyService.get_property(MOCK_PROPERTY_ID, MOCK_TENANT_ID)

    assert result["id"] == str(MOCK_PROPERTY_ID)


@pytest.mark.asyncio
@patch("app.features.properties.service.get_supabase_client")
async def test_create_property(mock_client):
    table_mock = _build_table_mock([MOCK_PROPERTY])
    mock_client.return_value.table.return_value = table_mock

    payload = PropertyCreate(title="Service Test Property")

    result = await PropertyService.create_property(payload, MOCK_TENANT_ID)

    assert result["title"] == "Service Test Property"


@pytest.mark.asyncio
@patch("app.features.properties.service.get_supabase_client")
async def test_update_property(mock_client):
    updated = {**MOCK_PROPERTY, "title": "Updated Title"}
    table_mock = _build_table_mock([updated])
    mock_client.return_value.table.return_value = table_mock

    payload = PropertyUpdate(title="Updated Title")

    result = await PropertyService.update_property(
        MOCK_PROPERTY_ID, payload, MOCK_TENANT_ID
    )

    assert result["title"] == "Updated Title"


@pytest.mark.asyncio
@patch("app.features.properties.service.get_supabase_client")
async def test_update_property_with_status(mock_client):
    updated = {**MOCK_PROPERTY, "status": "RESERVED"}
    table_mock = _build_table_mock([updated])
    mock_client.return_value.table.return_value = table_mock

    payload = PropertyUpdate(status="RESERVED")

    result = await PropertyService.update_property(
        MOCK_PROPERTY_ID, payload, MOCK_TENANT_ID
    )

    assert result["status"] == "RESERVED"


@pytest.mark.asyncio
@patch("app.features.properties.service.get_supabase_client")
async def test_delete_property(mock_client):
    table_mock = _build_table_mock([])
    mock_client.return_value.table.return_value = table_mock

    await PropertyService.delete_property(MOCK_PROPERTY_ID, MOCK_TENANT_ID)

    mock_client.return_value.table.assert_called_with("properties")
