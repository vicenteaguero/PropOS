"""Consent gate — Ley 21.719 Art. 12 and the block/objection rights of Art. 14.

The audit's finding was that `contacts.consent` was write-only: `revoked_at`
and `blocked_at` were stored and exported but never read, so a subject who
revoked kept receiving mail. These tests are the read side.
"""

from __future__ import annotations

from uuid import UUID

import pytest

from app.features.compliance import service as compliance_service
from app.features.compliance.service import (
    CONSENT_REQUIRED_PURPOSES,
    PURPOSE_EMAIL,
    PURPOSE_MARKETING,
    PURPOSE_OPERATIONAL,
    ComplianceService,
    ConsentDeniedError,
    client_ip_from_headers,
    evaluate_consent,
)
from tests.features.compliance.fakes import FakeSupabaseClient

CONTACT_ID = UUID("c0ffee00-0000-0000-0000-000000000001")
TENANT_ID = UUID("a1b2c3d4-e5f6-7890-abcd-ef1234567890")


def test_no_consent_recorded_blocks_marketing():
    """The state most real contacts are in, and they were being mailed anyway."""
    decision = evaluate_consent(None, PURPOSE_MARKETING)

    assert decision.allowed is False
    assert decision.reason == "no_consent_recorded"


def test_no_consent_recorded_still_allows_operational_handling():
    """Operational processing rests on the mandate, not on consent."""
    assert evaluate_consent(None, PURPOSE_OPERATIONAL).allowed is True


def test_granted_purpose_is_allowed():
    consent = {"purposes": [PURPOSE_MARKETING, PURPOSE_EMAIL], "granted_at": "2026-01-01T00:00:00Z"}

    assert evaluate_consent(consent, PURPOSE_MARKETING).allowed is True
    assert evaluate_consent(consent, PURPOSE_EMAIL).allowed is True


def test_revocation_stops_the_purposes_that_need_consent():
    consent = {"purposes": [], "revoked_at": "2026-06-01T00:00:00Z"}

    assert evaluate_consent(consent, PURPOSE_EMAIL).reason == "revoked"
    assert evaluate_consent(consent, PURPOSE_EMAIL).allowed is False
    assert evaluate_consent(consent, PURPOSE_MARKETING).allowed is False


def test_objection_to_one_purpose_leaves_the_others_alone():
    """Art. 14 opposition is per-finalidad, and revoke_consent implements it
    by dropping the purpose from the list."""
    consent = {"purposes": [PURPOSE_EMAIL], "granted_at": "2026-01-01T00:00:00Z"}

    assert evaluate_consent(consent, PURPOSE_EMAIL).allowed is True
    assert evaluate_consent(consent, PURPOSE_MARKETING).allowed is False


def test_block_stops_everything_including_operational():
    """A temporary block that still let operational mail through would be no block."""
    consent = {"purposes": [PURPOSE_OPERATIONAL], "blocked_at": "2026-07-01T00:00:00Z"}

    assert evaluate_consent(consent, PURPOSE_OPERATIONAL).allowed is False
    assert evaluate_consent(consent, PURPOSE_MARKETING).allowed is False
    assert evaluate_consent(consent, PURPOSE_OPERATIONAL).reason == "blocked"


def test_block_outranks_a_live_grant():
    consent = {"purposes": [PURPOSE_MARKETING], "blocked_at": "2026-07-01T00:00:00Z"}

    assert evaluate_consent(consent, PURPOSE_MARKETING).allowed is False


def test_erasure_outranks_a_block():
    consent = {"purposes": [PURPOSE_MARKETING], "blocked_at": "x", "erased_at": "y"}

    assert evaluate_consent(consent, PURPOSE_MARKETING).reason == "erased"


def test_failed_capture_marker_denies_the_consent_bound_purposes():
    """contacts/service.py writes this when recording the evidence blew up."""
    consent = {"purposes": [], "capture_failed_at": "2026-08-01T00:00:00Z"}

    assert evaluate_consent(consent, PURPOSE_MARKETING).allowed is False
    assert evaluate_consent(consent, PURPOSE_OPERATIONAL).allowed is True


def test_the_consent_bound_purposes_are_the_outbound_channels():
    assert CONSENT_REQUIRED_PURPOSES == {"marketing", "email", "whatsapp"}


async def test_assert_can_process_raises_for_a_revoked_subject(monkeypatch):
    client = FakeSupabaseClient(tables={"contacts": [{"consent": {"purposes": [], "revoked_at": "2026-06-01"}}]})
    monkeypatch.setattr(compliance_service, "get_supabase_client", lambda: client)

    with pytest.raises(ConsentDeniedError) as exc:
        await ComplianceService.assert_can_process(CONTACT_ID, TENANT_ID, PURPOSE_EMAIL)

    assert exc.value.reason == "revoked"
    assert exc.value.purpose == PURPOSE_EMAIL


async def test_assert_can_process_passes_for_a_granted_subject(monkeypatch):
    client = FakeSupabaseClient(tables={"contacts": [{"consent": {"purposes": [PURPOSE_EMAIL]}}]})
    monkeypatch.setattr(compliance_service, "get_supabase_client", lambda: client)

    await ComplianceService.assert_can_process(CONTACT_ID, TENANT_ID, PURPOSE_EMAIL)


async def test_a_contact_outside_the_tenant_is_refused_not_defaulted(monkeypatch):
    client = FakeSupabaseClient(tables={"contacts": []})
    monkeypatch.setattr(compliance_service, "get_supabase_client", lambda: client)

    decision = await ComplianceService.consent_decision(CONTACT_ID, TENANT_ID, PURPOSE_OPERATIONAL)

    assert decision.allowed is False
    assert decision.reason == "contact_not_found"


async def test_the_lookup_is_tenant_scoped(monkeypatch):
    client = FakeSupabaseClient(tables={"contacts": [{"consent": {}}]})
    monkeypatch.setattr(compliance_service, "get_supabase_client", lambda: client)

    await ComplianceService.consent_decision(CONTACT_ID, TENANT_ID, PURPOSE_OPERATIONAL)

    assert ("eq:tenant_id", str(TENANT_ID)) in client.calls[0]["filters"]


# --- consent evidence: the subject's IP, not the load balancer's -------------


def test_forwarded_for_wins_over_the_socket():
    assert client_ip_from_headers({"x-forwarded-for": "190.1.2.3, 35.191.0.1"}, "10.0.0.1") == "190.1.2.3"


def test_socket_is_used_when_there_is_no_proxy():
    assert client_ip_from_headers({}, "190.1.2.3") == "190.1.2.3"


def test_a_forged_header_cannot_write_free_text_into_the_evidence():
    assert client_ip_from_headers({"x-forwarded-for": "not-an-ip"}, "10.0.0.1") == "10.0.0.1"


def test_ipv4_with_a_port_and_bracketed_ipv6_are_normalised():
    assert client_ip_from_headers({"x-forwarded-for": "190.1.2.3:443"}, None) == "190.1.2.3"
    assert client_ip_from_headers({"x-forwarded-for": "[2001:db8::1]"}, None) == "2001:db8::1"
