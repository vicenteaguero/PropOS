from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

PROJECTS_PATH = "/api/projects"
MOCK_PROJECT_ID = str(uuid4())
MOCK_TENANT_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
MOCK_PROPERTY_ID = str(uuid4())

MOCK_PROJECT = {
    "id": MOCK_PROJECT_ID,
    "tenant_id": MOCK_TENANT_ID,
    "title": "Test Project",
    "slug": "test-project",
    "status": "PLANNING",
    "property_id": MOCK_PROPERTY_ID,
    "microsite_config": {"theme": "dark"},
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
async def test_list_projects(mock_client, client):
    table_mock = _build_table_mock([MOCK_PROJECT])
    mock_client.return_value.table.return_value = table_mock

    response = await client.get(PROJECTS_PATH)

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["title"] == "Test Project"


@pytest.mark.asyncio
@patch("app.features.projects.service.get_supabase_client")
async def test_get_project(mock_client, client):
    table_mock = _build_table_mock(MOCK_PROJECT)
    mock_client.return_value.table.return_value = table_mock

    response = await client.get(f"{PROJECTS_PATH}/{MOCK_PROJECT_ID}")

    assert response.status_code == 200
    assert response.json()["id"] == MOCK_PROJECT_ID


@pytest.mark.asyncio
@patch("app.features.projects.service.get_supabase_client")
async def test_create_project(mock_client, client):
    table_mock = _build_table_mock([MOCK_PROJECT])
    mock_client.return_value.table.return_value = table_mock

    payload = {
        "title": "Test Project",
        "slug": "test-project",
        "status": "PLANNING",
        "property_id": MOCK_PROPERTY_ID,
        "microsite_config": {"theme": "dark"},
    }

    response = await client.post(PROJECTS_PATH, json=payload)

    assert response.status_code == 201
    assert response.json()["title"] == "Test Project"
    assert response.json()["slug"] == "test-project"


@pytest.mark.asyncio
@patch("app.features.projects.service.get_supabase_client")
async def test_update_project(mock_client, client):
    updated_project = {**MOCK_PROJECT, "title": "Updated Project", "status": "ACTIVE"}
    table_mock = _build_table_mock([updated_project])
    mock_client.return_value.table.return_value = table_mock

    payload = {"title": "Updated Project", "status": "ACTIVE"}

    response = await client.patch(f"{PROJECTS_PATH}/{MOCK_PROJECT_ID}", json=payload)

    assert response.status_code == 200
    assert response.json()["title"] == "Updated Project"
    assert response.json()["status"] == "ACTIVE"


@pytest.mark.asyncio
@patch("app.features.projects.service.get_supabase_client")
async def test_delete_project(mock_client, client):
    table_mock = _build_table_mock([])
    mock_client.return_value.table.return_value = table_mock

    response = await client.delete(f"{PROJECTS_PATH}/{MOCK_PROJECT_ID}")

    assert response.status_code == 204
