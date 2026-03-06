from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

PROPERTIES_PATH = "/api/properties"
MOCK_PROPERTY_ID = str(uuid4())
MOCK_TENANT_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"

MOCK_PROPERTY = {
    "id": MOCK_PROPERTY_ID,
    "tenant_id": MOCK_TENANT_ID,
    "title": "Test Property",
    "description": "A test property",
    "status": "AVAILABLE",
    "address": "123 Test St",
    "surface_m2": 150.0,
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
async def test_list_properties(mock_client, client):
    table_mock = _build_table_mock([MOCK_PROPERTY])
    mock_client.return_value.table.return_value = table_mock

    response = await client.get(PROPERTIES_PATH)

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["title"] == "Test Property"


@pytest.mark.asyncio
@patch("app.features.properties.service.get_supabase_client")
async def test_get_property(mock_client, client):
    table_mock = _build_table_mock(MOCK_PROPERTY)
    mock_client.return_value.table.return_value = table_mock

    response = await client.get(f"{PROPERTIES_PATH}/{MOCK_PROPERTY_ID}")

    assert response.status_code == 200
    assert response.json()["id"] == MOCK_PROPERTY_ID


@pytest.mark.asyncio
@patch("app.features.properties.service.get_supabase_client")
async def test_create_property(mock_client, client):
    table_mock = _build_table_mock([MOCK_PROPERTY])
    mock_client.return_value.table.return_value = table_mock

    payload = {
        "title": "Test Property",
        "description": "A test property",
        "status": "AVAILABLE",
        "address": "123 Test St",
        "surface_m2": 150.0,
    }

    response = await client.post(PROPERTIES_PATH, json=payload)

    assert response.status_code == 201
    assert response.json()["title"] == "Test Property"


@pytest.mark.asyncio
@patch("app.features.properties.service.get_supabase_client")
async def test_update_property(mock_client, client):
    updated_property = {
        **MOCK_PROPERTY,
        "title": "Updated Property",
    }
    table_mock = _build_table_mock([updated_property])
    mock_client.return_value.table.return_value = table_mock

    payload = {"title": "Updated Property"}

    response = await client.patch(f"{PROPERTIES_PATH}/{MOCK_PROPERTY_ID}", json=payload)

    assert response.status_code == 200
    assert response.json()["title"] == "Updated Property"


@pytest.mark.asyncio
@patch("app.features.properties.service.get_supabase_client")
async def test_delete_property(mock_client, client):
    table_mock = _build_table_mock([])
    mock_client.return_value.table.return_value = table_mock

    response = await client.delete(f"{PROPERTIES_PATH}/{MOCK_PROPERTY_ID}")

    assert response.status_code == 204
