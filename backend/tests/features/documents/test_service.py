from unittest.mock import MagicMock, patch
from uuid import UUID, uuid4

import pytest

from app.features.documents.schemas import DocumentCreate, DocumentUpdate
from app.features.documents.service import DocumentService

MOCK_TENANT_ID = UUID("a1b2c3d4-e5f6-7890-abcd-ef1234567890")
MOCK_DOCUMENT_ID = uuid4()
MOCK_ENTITY_ID = uuid4()

MOCK_DOCUMENT = {
    "id": str(MOCK_DOCUMENT_ID),
    "tenant_id": str(MOCK_TENANT_ID),
    "filename": "service-test.pdf",
    "storage_path": "docs/service-test.pdf",
    "entity_type": "property",
    "entity_id": str(MOCK_ENTITY_ID),
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
async def test_list_documents(mock_client):
    table_mock = _build_table_mock([MOCK_DOCUMENT])
    mock_client.return_value.table.return_value = table_mock

    result = await DocumentService.list_documents(MOCK_TENANT_ID)

    assert len(result) == 1
    assert result[0]["filename"] == "service-test.pdf"


@pytest.mark.asyncio
@patch("app.features.documents.service.get_supabase_client")
async def test_get_document(mock_client):
    table_mock = _build_table_mock(MOCK_DOCUMENT)
    mock_client.return_value.table.return_value = table_mock

    result = await DocumentService.get_document(MOCK_DOCUMENT_ID, MOCK_TENANT_ID)

    assert result["id"] == str(MOCK_DOCUMENT_ID)


@pytest.mark.asyncio
@patch("app.features.documents.service.get_supabase_client")
async def test_create_document(mock_client):
    table_mock = _build_table_mock([MOCK_DOCUMENT])
    mock_client.return_value.table.return_value = table_mock

    payload = DocumentCreate(
        filename="service-test.pdf",
        storage_path="docs/service-test.pdf",
        entity_type="property",
        entity_id=MOCK_ENTITY_ID,
    )

    result = await DocumentService.create_document(payload, MOCK_TENANT_ID)

    assert result["filename"] == "service-test.pdf"


@pytest.mark.asyncio
@patch("app.features.documents.service.get_supabase_client")
async def test_update_document(mock_client):
    updated = {**MOCK_DOCUMENT, "filename": "renamed.pdf"}
    table_mock = _build_table_mock([updated])
    mock_client.return_value.table.return_value = table_mock

    payload = DocumentUpdate(filename="renamed.pdf")

    result = await DocumentService.update_document(
        MOCK_DOCUMENT_ID, payload, MOCK_TENANT_ID
    )

    assert result["filename"] == "renamed.pdf"


@pytest.mark.asyncio
@patch("app.features.documents.service.get_supabase_client")
async def test_update_document_with_entity_id(mock_client):
    new_entity_id = uuid4()
    updated = {**MOCK_DOCUMENT, "entity_id": str(new_entity_id)}
    table_mock = _build_table_mock([updated])
    mock_client.return_value.table.return_value = table_mock

    payload = DocumentUpdate(entity_id=new_entity_id)

    result = await DocumentService.update_document(
        MOCK_DOCUMENT_ID, payload, MOCK_TENANT_ID
    )

    assert result["entity_id"] == str(new_entity_id)


@pytest.mark.asyncio
@patch("app.features.documents.service.get_supabase_client")
async def test_delete_document(mock_client):
    table_mock = _build_table_mock([])
    mock_client.return_value.table.return_value = table_mock

    await DocumentService.delete_document(MOCK_DOCUMENT_ID, MOCK_TENANT_ID)

    mock_client.return_value.table.assert_called_with("documents")
