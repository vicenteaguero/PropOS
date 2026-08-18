"""Lead → contact resolution: the buyer, not the portal's no-reply address."""

from __future__ import annotations

from unittest.mock import MagicMock

from app.features.email_sync.parsers import ParsedLead
from app.features.email_sync.sync import _lead_identity, _match_or_create_contact

TENANT_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"


def _client(match_results: list[list[dict]]) -> tuple[MagicMock, MagicMock]:
    """Supabase stub whose selects return the queued results in order."""
    table = MagicMock()
    for method in ("select", "eq", "is_", "ilike", "limit", "insert"):
        getattr(table, method).return_value = table
    results = [MagicMock(data=r) for r in match_results]
    table.execute.side_effect = results
    client = MagicMock()
    client.table.return_value = table
    return client, table


class TestLeadIdentity:
    def test_portal_lead_with_details_overrides_the_sender(self):
        lead = ParsedLead(portal="Yapo", contact_name="Verónica", contact_phone="+56957181497")
        assert _lead_identity(lead) == {"email": None, "name": "Verónica", "phone": "+56957181497"}

    def test_lead_without_any_detail_falls_back(self):
        assert _lead_identity(ParsedLead(portal="Yapo")) is None

    def test_no_lead_falls_back(self):
        assert _lead_identity(None) is None


class TestMatchOrCreateContact:
    def test_matches_an_existing_contact_by_phone_suffix(self):
        client, table = _client([[{"id": "c-1"}]])

        got = _match_or_create_contact(client, TENANT_ID, phone="+56957181497", name="Verónica")

        assert got == "c-1"
        table.ilike.assert_called_once_with("phone", "%57181497")
        table.insert.assert_not_called()

    def test_falls_back_to_email_match(self):
        client, table = _client([[], [{"id": "c-2"}]])

        got = _match_or_create_contact(client, TENANT_ID, email="maria@gmail.com", phone="+56990905082")

        assert got == "c-2"
        table.insert.assert_not_called()

    def test_creates_the_buyer_with_name_and_phone(self):
        client, table = _client([[], [{"id": "c-3"}]])

        got = _match_or_create_contact(client, TENANT_ID, phone="+56957181497", name="Verónica")

        assert got == "c-3"
        row = table.insert.call_args[0][0]
        assert row["full_name"] == "Verónica"
        assert row["phone"] == "+56957181497"
        assert row["type"] == "BUYER"
        assert "email" not in row

    def test_two_leads_from_one_portal_do_not_collapse(self):
        # Different phones → two lookups miss → two distinct contacts.
        first_client, first_table = _client([[], [{"id": "c-a"}]])
        second_client, second_table = _client([[], [{"id": "c-b"}]])

        a = _match_or_create_contact(first_client, TENANT_ID, phone="+56911111111", name="Ana")
        b = _match_or_create_contact(second_client, TENANT_ID, phone="+56922222222", name="Beto")

        assert a != b
        assert first_table.insert.call_args[0][0]["full_name"] == "Ana"
        assert second_table.insert.call_args[0][0]["full_name"] == "Beto"

    def test_no_identity_at_all_creates_nothing(self):
        client, table = _client([])

        assert _match_or_create_contact(client, TENANT_ID) is None
        table.insert.assert_not_called()

    def test_sender_fallback_still_matches_by_email(self):
        client, table = _client([[{"id": "c-4"}]])

        got = _match_or_create_contact(client, TENANT_ID, email="cliente@gmail.com", name="Cliente")

        assert got == "c-4"
        table.eq.assert_any_call("email", "cliente@gmail.com")
