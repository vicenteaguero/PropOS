"""Tests for the Kapso integration: signature, dispatcher, channel router."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from app.features.integrations.kapso import signature
from app.features.notifications.whatsapp import dispatcher, templates


# ─────────────────────── signature ───────────────────────


def test_signature_verify_match():
    secret = "shh"
    body = b'{"hello":"world"}'
    sig = signature.compute(secret, body)
    assert signature.verify(secret, body, sig) is True
    assert signature.verify(secret, body, "sha256=" + sig) is True


def test_signature_verify_mismatch():
    secret = "shh"
    body = b"x"
    assert signature.verify(secret, body, "deadbeef") is False
    assert signature.verify(secret, body, None) is False
    assert signature.verify("", body, "anything") is False


# ─────────────────────── templates ───────────────────────


def test_template_registry_render():
    t = templates.get("visit_confirmation")
    rendered = templates.render_variables(
        t,
        {
            "contact_name": "Juan",
            "property_address": "Calle 123",
            "datetime": "lunes 10:00",
        },
    )
    assert rendered == ["Juan", "Calle 123", "lunes 10:00"]


def test_template_missing_var_raises():
    t = templates.get("visit_confirmation")
    with pytest.raises(ValueError):
        templates.render_variables(t, {"contact_name": "Juan"})


def test_template_unknown_raises():
    with pytest.raises(KeyError):
        templates.get("nope")


# ─────────────────────── dispatcher: 24h window + consent gates ─────────


def _supabase_table(rows_by_table: dict[str, list[dict]]):
    """Tiny stand-in that returns canned rows; swallows writes."""

    class Q:
        def __init__(self, rows: list[dict]) -> None:
            self.rows = rows
            self._single = False

        def select(self, *_a, **_k):
            return self

        def eq(self, *_a, **_k):
            return self

        def order(self, *_a, **_k):
            return self

        def limit(self, *_a, **_k):
            return self

        def single(self):
            self._single = True
            return self

        def insert(self, _row):
            return self

        def update(self, _row):
            return self

        def execute(self):
            class R:
                pass

            r = R()
            r.data = (self.rows[0] if self.rows else None) if self._single else self.rows
            return r

    class Client:
        def table(self, name: str):
            return Q(rows_by_table.get(name, []))

    return Client()


def test_dispatcher_blocks_without_consent(monkeypatch):
    client = _supabase_table({"client_consents": []})
    monkeypatch.setattr(
        "app.features.notifications.whatsapp.dispatcher.get_supabase_client",
        lambda: client,
    )
    with pytest.raises(dispatcher.ConsentError):
        # Run as sync — function is async; use asyncio.run
        import asyncio

        asyncio.run(
            dispatcher.send_template_to_contact(
                "tenant-1",
                "contact-1",
                "+56911111111",
                "visit_confirmation",
                {"contact_name": "x", "property_address": "y", "datetime": "z"},
            )
        )


def test_dispatcher_window_outside_24h_blocks_freeform(monkeypatch):
    yesterday = (datetime.now(UTC) - timedelta(hours=48)).isoformat()
    client = _supabase_table(
        {
            "client_conversations": [
                {
                    "id": "c1",
                    "tenant_id": "t1",
                    "contact_id": "ct1",
                    "external_phone_e164": "+56999",
                    "last_inbound_at": yesterday,
                }
            ],
            "client_consents": [{"opted_in_at": "2024-01-01"}],
        }
    )
    monkeypatch.setattr(
        "app.features.notifications.whatsapp.dispatcher.get_supabase_client",
        lambda: client,
    )
    import asyncio

    with pytest.raises(dispatcher.WindowError):
        asyncio.run(dispatcher.send_freeform_to_conversation("t1", "c1", "hola"))


# ─────────────────────── channel router identity ───────────────────────


def test_router_internal_user_match(monkeypatch):
    from app.features.channels import router as ch_router

    db = _supabase_table({"user_phones": [{"user_id": "u1", "tenant_id": "t1", "phone_e164": "+56999"}]})
    monkeypatch.setattr("app.features.channels.router.get_supabase_client", lambda: db)
    match = ch_router._match_internal_user("+56999")
    assert match is not None
    assert match["user_id"] == "u1"


def test_router_external_contact_no_match(monkeypatch):
    from app.features.channels import router as ch_router

    db = _supabase_table({"user_phones": []})
    monkeypatch.setattr("app.features.channels.router.get_supabase_client", lambda: db)
    assert ch_router._match_internal_user("+56000") is None
