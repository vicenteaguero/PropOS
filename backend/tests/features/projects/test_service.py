from unittest.mock import MagicMock, patch
from uuid import UUID, uuid4

import pytest

from app.features.projects.schemas import ProjectCreate, ProjectUpdate
from app.features.projects.service import ProjectService

MOCK_TENANT_ID = UUID("a1b2c3d4-e5f6-7890-abcd-ef1234567890")
MOCK_PROJECT_ID = uuid4()
MOCK_PROPERTY_ID = uuid4()

MOCK_PROJECT = {
    "id": str(MOCK_PROJECT_ID),
    "tenant_id": str(MOCK_TENANT_ID),
    "title": "Service Test Project",
    "slug": "service-test",
    "status": "PLANNING",
    "property_id": str(MOCK_PROPERTY_ID),
    "microsite_config": None,
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
@patch("app.features.projects.service.get_supabase_client")
async def test_list_projects(mock_client):
    table_mock = _build_table_mock([MOCK_PROJECT])
    mock_client.return_value.table.return_value = table_mock

    result = await ProjectService.list_projects(MOCK_TENANT_ID)

    assert len(result) == 1
    assert result[0]["title"] == "Service Test Project"


@pytest.mark.asyncio
@patch("app.features.projects.service.get_supabase_client")
async def test_get_project(mock_client):
    table_mock = _build_table_mock(MOCK_PROJECT)
    mock_client.return_value.table.return_value = table_mock

    result = await ProjectService.get_project(MOCK_PROJECT_ID, MOCK_TENANT_ID)

    assert result["id"] == str(MOCK_PROJECT_ID)


@pytest.mark.asyncio
@patch("app.features.projects.service.get_supabase_client")
async def test_create_project(mock_client):
    table_mock = _build_table_mock([MOCK_PROJECT])
    mock_client.return_value.table.return_value = table_mock

    payload = ProjectCreate(
        title="Service Test Project",
        slug="service-test",
        property_id=MOCK_PROPERTY_ID,
    )

    result = await ProjectService.create_project(payload, MOCK_TENANT_ID)

    assert result["title"] == "Service Test Project"


@pytest.mark.asyncio
@patch("app.features.projects.service.get_supabase_client")
async def test_update_project(mock_client):
    updated = {**MOCK_PROJECT, "title": "Updated Title", "status": "ACTIVE"}
    table_mock = _build_table_mock([updated])
    mock_client.return_value.table.return_value = table_mock

    payload = ProjectUpdate(title="Updated Title", status="ACTIVE")

    result = await ProjectService.update_project(
        MOCK_PROJECT_ID, payload, MOCK_TENANT_ID
    )

    assert result["title"] == "Updated Title"
    assert result["status"] == "ACTIVE"


@pytest.mark.asyncio
@patch("app.features.projects.service.get_supabase_client")
async def test_delete_project(mock_client):
    table_mock = _build_table_mock([])
    mock_client.return_value.table.return_value = table_mock

    await ProjectService.delete_project(MOCK_PROJECT_ID, MOCK_TENANT_ID)

    mock_client.return_value.table.assert_called_with("projects")
