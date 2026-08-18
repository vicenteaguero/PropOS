"""Right to erasure — Ley 21.719 Art. 14.

Before this, a "deleted" contact kept its RUT, phone and e-mail in four places:
the soft-deleted row, the aliases, the media blobs and every audit snapshot.
These tests assert the payload of each of the four writes, because none of them
can be inspected after the fact.
"""

from __future__ import annotations

from uuid import UUID

import pytest

from app.features.compliance import service as compliance_service
from app.features.compliance.service import (
    ERASURE_MEDIA_GRACE_DAYS,
    ERASURE_TOMBSTONE_NAME,
    PII_FIELDS,
    ComplianceService,
    evaluate_consent,
)
from tests.features.compliance.fakes import FakeSupabaseClient

CONTACT_ID = UUID("c0ffee00-0000-0000-0000-000000000001")
TENANT_ID = UUID("a1b2c3d4-e5f6-7890-abcd-ef1234567890")
MEDIA_ID = "dddd0000-0000-0000-0000-000000000009"


def _client(**overrides):
    tables = {
        "contacts": [{"id": str(CONTACT_ID)}],
        "person_aliases": [{"id": "1"}, {"id": "2"}],
        "interaction_participants": [{"interaction_id": "aaaa0000-0000-0000-0000-000000000001"}],
        "interactions": [{"raw_transcript_id": "bbbb0000-0000-0000-0000-000000000002"}],
        "agent_transcripts": [{"media_file_id": MEDIA_ID}],
        "media_files": [{}],
    }
    tables.update(overrides)
    return FakeSupabaseClient(tables=tables, rpc_results={"compliance_redact_subject_audit": 12})


@pytest.fixture
def fake_client(monkeypatch):
    client = _client()
    monkeypatch.setattr(compliance_service, "get_supabase_client", lambda: client)
    return client


async def test_contact_becomes_a_tombstone(fake_client):
    await ComplianceService.erase_subject(CONTACT_ID, TENANT_ID, reason="DSAR 2026-08-16")

    payload = fake_client.writes_to("contacts")[0]["payload"]

    assert payload["full_name"] == ERASURE_TOMBSTONE_NAME
    for column in ("email", "phone", "rut", "birthdate", "address", "notes"):
        assert payload[column] is None, f"{column} survived the erasure"
    assert payload["metadata"] == {}
    assert payload["erased_at"]
    assert payload["deleted_at"]


async def test_erased_contact_is_refused_for_every_purpose(fake_client):
    """The tombstone's consent state must itself deny processing."""
    await ComplianceService.erase_subject(CONTACT_ID, TENANT_ID)

    consent = fake_client.writes_to("contacts")[0]["payload"]["consent"]

    assert evaluate_consent(consent, "operacional").allowed is False
    assert evaluate_consent(consent, "marketing").allowed is False
    assert evaluate_consent(consent, "email").reason == "erased"


async def test_aliases_are_deleted_not_tombstoned(fake_client):
    """An alias is only a name; there is nothing left to keep."""
    await ComplianceService.erase_subject(CONTACT_ID, TENANT_ID)

    deletes = fake_client.deletes_from("person_aliases")

    assert len(deletes) == 1
    assert ("eq:person_id", str(CONTACT_ID)) in deletes[0]["filters"]
    assert ("eq:tenant_id", str(TENANT_ID)) in deletes[0]["filters"]


async def test_reachable_media_is_scheduled_for_purge(fake_client):
    await ComplianceService.erase_subject(CONTACT_ID, TENANT_ID)

    media_write = fake_client.writes_to("media_files")[0]

    assert ("in:id", [MEDIA_ID]) in media_write["filters"]
    assert media_write["payload"]["purge_after"]


async def test_audit_snapshots_are_redacted_with_the_python_field_list(fake_client):
    """The SQL default exists as a fallback; the backend passes the tested list."""
    result = await ComplianceService.erase_subject(CONTACT_ID, TENANT_ID)

    params = fake_client.rpc_params("compliance_redact_subject_audit")

    assert params["p_contact_id"] == str(CONTACT_ID)
    assert params["p_tenant_id"] == str(TENANT_ID)
    assert params["p_fields"] == list(PII_FIELDS)
    assert result["audit_rows_redacted"] == 12


async def test_audit_rows_are_redacted_never_deleted(fake_client):
    """20240601000047 made audit_log append-only; erasure must not undo that."""
    await ComplianceService.erase_subject(CONTACT_ID, TENANT_ID)

    assert fake_client.deletes_from("audit_log") == []


async def test_erasure_is_scoped_to_the_active_tenant(fake_client):
    await ComplianceService.erase_subject(CONTACT_ID, TENANT_ID)

    contact_write = fake_client.writes_to("contacts")[0]

    assert ("eq:tenant_id", str(TENANT_ID)) in contact_write["filters"]
    assert ("eq:id", str(CONTACT_ID)) in contact_write["filters"]


async def test_unknown_contact_raises_before_touching_anything(monkeypatch):
    client = _client(contacts=[])
    monkeypatch.setattr(compliance_service, "get_supabase_client", lambda: client)

    with pytest.raises(LookupError):
        await ComplianceService.erase_subject(CONTACT_ID, TENANT_ID)

    assert client.writes_to("contacts") == []
    assert client.rpc_calls == []


async def test_subject_with_no_media_skips_the_media_write(monkeypatch):
    client = _client(interaction_participants=[])
    monkeypatch.setattr(compliance_service, "get_supabase_client", lambda: client)

    result = await ComplianceService.erase_subject(CONTACT_ID, TENANT_ID)

    assert result["media_scheduled_for_purge"] == 0
    assert client.writes_to("media_files") == []


async def test_media_grace_window_matches_the_documented_one(fake_client):
    """docs/compliance/dsar-procedure.md promises a 30-day recovery window."""
    assert ERASURE_MEDIA_GRACE_DAYS == 30
