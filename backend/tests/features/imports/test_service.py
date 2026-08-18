"""CSV import preview/commit, including the properties entity (backfill path)."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.features.imports.router import _ENTITIES
from app.features.imports.service import ImportService

TENANT_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
USER_ID = "11111111-1111-1111-1111-111111111111"

PROPERTY_CSV = (
    "Título,Dirección,Comuna,Tipo,Operación,Dormitorios,Baños,Superficie,Precio,Moneda\n"
    "Casa Rancagua,Av. Siempre Viva 742,Rancagua,Casa,Venta,3,2,120,90.000.000,CLP\n"
    "Depto centro,Calle Falsa 1,Machalí,Departamento,Arriendo,1,1,45,450.000,CLP\n"
).encode()


def _client_with_job(job_row: dict | None = None) -> tuple[MagicMock, MagicMock]:
    table = MagicMock()
    for method in ("select", "eq", "is_", "order", "range", "limit", "insert", "update", "single"):
        getattr(table, method).return_value = table
    table.execute.return_value = MagicMock(data=[job_row or {"id": "job-1"}])
    client = MagicMock()
    client.table.return_value = table
    return client, table


def test_properties_is_an_accepted_entity():
    assert "properties" in _ENTITIES


@pytest.mark.asyncio
@patch("app.features.imports.service.get_supabase_client")
async def test_preview_stages_valid_property_rows(mock_client):
    client, table = _client_with_job()
    mock_client.return_value = client

    out = await ImportService.preview("properties", "props.csv", PROPERTY_CSV, TENANT_ID, USER_ID)

    assert out["total_rows"] == 2
    assert out["valid_rows"] == 2
    assert out["errors"] == []
    first = out["sample_rows"][0]
    assert first["_valid"] is True
    assert first["title"] == "Casa Rancagua"
    assert first["list_price_cents"] == 90_000_000_00
    assert first["listing_kind"] == "SALE"
    assert first["metadata"]["comuna"] == "Rancagua"


@pytest.mark.asyncio
@patch("app.features.imports.service.get_supabase_client")
async def test_preview_reports_the_row_missing_a_title(mock_client):
    client, _ = _client_with_job()
    mock_client.return_value = client
    csv_bytes = b"Comuna,Precio\nRancagua,90.000.000\n"

    out = await ImportService.preview("properties", "props.csv", csv_bytes, TENANT_ID, USER_ID)

    assert out["valid_rows"] == 0
    assert out["invalid_rows"] == 1
    assert out["errors"][0]["row"] == 0


@pytest.mark.asyncio
@patch("app.features.imports.service.get_supabase_client")
async def test_commit_inserts_properties_without_a_source_column(mock_client):
    job = {
        "id": "job-1",
        "status": "PREVIEW",
        "entity": "properties",
        "rows": [{"_valid": True, "title": "Casa", "list_price_cents": 100}],
    }
    client = MagicMock()
    table = MagicMock()
    for method in ("select", "eq", "single", "update"):
        getattr(table, method).return_value = table
    table.execute.return_value = MagicMock(data=job)
    insert_table = MagicMock()
    insert_table.insert.return_value = insert_table
    insert_table.execute.return_value = MagicMock(data=[{"id": "p1"}])

    def pick(name):
        return table if name == "import_jobs" else insert_table

    client.table.side_effect = pick
    mock_client.return_value = client

    out = await ImportService.commit("dddddddd-dddd-dddd-dddd-dddddddddddd", TENANT_ID, USER_ID)

    inserted = insert_table.insert.call_args[0][0]
    assert out["inserted_rows"] == 1
    assert inserted[0]["tenant_id"] == TENANT_ID
    # properties has no `source` column: stamping it would break the insert.
    assert "source" not in inserted[0]


@pytest.mark.asyncio
@patch("app.features.imports.service.get_supabase_client")
async def test_commit_still_stamps_source_on_contacts(mock_client):
    job = {
        "id": "job-1",
        "status": "PREVIEW",
        "entity": "contacts",
        "rows": [{"_valid": True, "full_name": "Ana"}],
    }
    client = MagicMock()
    table = MagicMock()
    for method in ("select", "eq", "single", "update"):
        getattr(table, method).return_value = table
    table.execute.return_value = MagicMock(data=job)
    insert_table = MagicMock()
    insert_table.insert.return_value = insert_table
    insert_table.execute.return_value = MagicMock(data=[{"id": "c1"}])
    client.table.side_effect = lambda name: table if name == "import_jobs" else insert_table
    mock_client.return_value = client

    await ImportService.commit("dddddddd-dddd-dddd-dddd-dddddddddddd", TENANT_ID, USER_ID)

    assert insert_table.insert.call_args[0][0][0]["source"] == "import"
