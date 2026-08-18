"""Every portal lead must land on the contact's interaction timeline."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from app.features.email_sync.parsers import ParsedLead
from app.features.email_sync.sync import _log_lead_interaction, _resolve_property_id

TENANT_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
CONTACT_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc"
PROPERTY_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd"


def _client(publication_rows: list[dict] | None = None) -> tuple[MagicMock, dict[str, MagicMock]]:
    tables: dict[str, MagicMock] = {}

    def make(name: str) -> MagicMock:
        if name in tables:
            return tables[name]
        table = MagicMock()
        for method in ("select", "eq", "is_", "limit", "insert"):
            getattr(table, method).return_value = table
        if name == "publications":
            table.execute.return_value = MagicMock(data=publication_rows or [])
        elif name == "interactions":
            table.execute.return_value = MagicMock(data=[{"id": "i-1"}])
        else:
            table.execute.return_value = MagicMock(data=[{"id": "x"}])
        tables[name] = table
        return table

    client = MagicMock()
    client.table.side_effect = make
    return client, tables


LEAD = ParsedLead(
    portal="Yapo",
    property_external_id="32327",
    contact_name="Verónica",
    contact_phone="+56957181497",
)


def test_interaction_row_written_with_email_kind_and_portal_channel():
    client, tables = _client()

    _log_lead_interaction(
        client,
        TENANT_ID,
        lead=LEAD,
        contact_id=CONTACT_ID,
        subject="Yapo.cl - Interesado en anuncio",
        body="Nombre: Verónica",
        sent_at="2026-08-16T12:00:00+00:00",
    )

    row = tables["interactions"].insert.call_args[0][0]
    assert row["kind"] == "EMAIL"
    assert row["channel"] == "Yapo"
    assert row["tenant_id"] == TENANT_ID
    assert row["occurred_at"] == "2026-08-16T12:00:00+00:00"
    # 'email_sync' is not in the source CHECK constraint; 'import' is.
    assert row["source"] == "import"


def test_contact_is_attached_as_participant():
    client, tables = _client()

    _log_lead_interaction(client, TENANT_ID, lead=LEAD, contact_id=CONTACT_ID, subject="s", body="b", sent_at=None)

    participant = tables["interaction_participants"].insert.call_args[0][0]
    assert participant["person_id"] == CONTACT_ID
    assert participant["interaction_id"] == "i-1"


def test_property_target_linked_through_the_publication_external_id():
    client, tables = _client(publication_rows=[{"property_id": PROPERTY_ID}])

    _log_lead_interaction(client, TENANT_ID, lead=LEAD, contact_id=CONTACT_ID, subject="s", body="b", sent_at=None)

    target = tables["interaction_targets"].insert.call_args[0][0]
    assert target["target_kind"] == "PROPERTY"
    assert target["property_id"] == PROPERTY_ID


def test_unknown_listing_leaves_the_interaction_untargeted():
    client, tables = _client(publication_rows=[])

    _log_lead_interaction(client, TENANT_ID, lead=LEAD, contact_id=CONTACT_ID, subject="s", body="b", sent_at=None)

    assert "interaction_targets" not in tables


def test_occurred_at_omitted_when_the_date_header_is_unparseable():
    client, tables = _client()

    _log_lead_interaction(client, TENANT_ID, lead=LEAD, contact_id=None, subject="s", body="b", sent_at=None)

    assert "occurred_at" not in tables["interactions"].insert.call_args[0][0]
    assert "interaction_participants" not in tables


@pytest.mark.parametrize("external_id", [None, ""])
def test_property_lookup_skipped_without_an_external_id(external_id):
    client, _ = _client()
    assert _resolve_property_id(client, TENANT_ID, external_id) is None
    client.table.assert_not_called()
