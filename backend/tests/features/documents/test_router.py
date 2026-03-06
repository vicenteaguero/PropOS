from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

DOCUMENTS_PATH = "/api/documents"
MOCK_DOCUMENT_ID = str(uuid4())
MOCK_TENANT_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
MOCK_ENTITY_ID = str(uuid4())

MOCK_DOCUMENT = {
    "id": MOCK_DOCUMENT_ID,
    "tenant_id": MOCK_TENANT_ID,
    "filename": "contract.pdf",
    "storage_path": "documents/contract.pdf",
    "entity_type": "property",
    "entity_id": MOCK_ENTITY_ID,
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
@patch("app.features.documents.service.get_supabase_client")
async def test_list_documents(mock_client, client):
    table_mock = _build_table_mock([MOCK_DOCUMENT])
    mock_client.return_value.table.return_value = table_mock

    response = await client.get(DOCUMENTS_PATH)

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["filename"] == "contract.pdf"


@pytest.mark.asyncio
@patch("app.features.documents.service.get_supabase_client")
async def test_get_document(mock_client, client):
    table_mock = _build_table_mock(MOCK_DOCUMENT)
    mock_client.return_value.table.return_value = table_mock

    response = await client.get(f"{DOCUMENTS_PATH}/{MOCK_DOCUMENT_ID}")

    assert response.status_code == 200
    assert response.json()["id"] == MOCK_DOCUMENT_ID


@pytest.mark.asyncio
@patch("app.features.documents.service.get_supabase_client")
async def test_create_document(mock_client, client):
    table_mock = _build_table_mock([MOCK_DOCUMENT])
    mock_client.return_value.table.return_value = table_mock

    payload = {
        "filename": "contract.pdf",
        "storage_path": "documents/contract.pdf",
        "entity_type": "property",
        "entity_id": MOCK_ENTITY_ID,
    }

    response = await client.post(DOCUMENTS_PATH, json=payload)

    assert response.status_code == 201
    assert response.json()["filename"] == "contract.pdf"


@pytest.mark.asyncio
@patch("app.features.documents.service.get_supabase_client")
async def test_update_document(mock_client, client):
    updated_document = {
        **MOCK_DOCUMENT,
        "filename": "updated-contract.pdf",
    }
    table_mock = _build_table_mock([updated_document])
    mock_client.return_value.table.return_value = table_mock

    payload = {"filename": "updated-contract.pdf"}

    response = await client.patch(
        f"{DOCUMENTS_PATH}/{MOCK_DOCUMENT_ID}", json=payload
    )

    assert response.status_code == 200
    assert response.json()["filename"] == "updated-contract.pdf"


@pytest.mark.asyncio
@patch("app.features.documents.service.get_supabase_client")
async def test_delete_document(mock_client, client):
    table_mock = _build_table_mock([])
    mock_client.return_value.table.return_value = table_mock

    response = await client.delete(f"{DOCUMENTS_PATH}/{MOCK_DOCUMENT_ID}")

    assert response.status_code == 204
