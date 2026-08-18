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


def _phones_db(phone_row: dict | None, membership: dict | None) -> _FakeDB:
    return _FakeDB(
        {
            "user_phones": [phone_row] if phone_row else [],
            "tenant_memberships": [membership] if membership else [],
        }
    )


def _verified_phone(**overrides) -> dict:
    return {
        "user_id": "u1",
        "tenant_id": "t1",
        "phone_e164": "+56999",
        "verified_at": "2026-07-01T00:00:00+00:00",
        **overrides,
    }


def _admin_membership(**overrides) -> dict:
    return {
        "user_id": "u1",
        "tenant_id": "t1",
        "role": "ADMIN",
        "admin_scope": [],
        "is_active": True,
        **overrides,
    }


def test_router_internal_user_match(monkeypatch):
    from app.features.channels import router as ch_router

    db = _phones_db(_verified_phone(), _admin_membership())
    _patch_db(monkeypatch, db, "app.features.channels.router")
    match = ch_router._match_internal_user("+56999")
    assert match is not None
    assert match["user_id"] == "u1"


def test_router_external_contact_no_match(monkeypatch):
    from app.features.channels import router as ch_router

    db = _phones_db(None, None)
    _patch_db(monkeypatch, db, "app.features.channels.router")
    assert ch_router._match_internal_user("+56000") is None


# ─────────────── internal-user gate (P2-08) ───────────────


def test_unverified_phone_is_not_internal(monkeypatch):
    from app.features.channels import router as ch_router

    db = _phones_db(_verified_phone(verified_at=None), _admin_membership())
    _patch_db(monkeypatch, db, "app.features.channels.router")
    assert ch_router._match_internal_user("+56999") is None


def test_non_admin_phone_is_not_internal(monkeypatch):
    from app.features.channels import router as ch_router

    db = _phones_db(_verified_phone(), _admin_membership(role="AGENT"))
    _patch_db(monkeypatch, db, "app.features.channels.router")
    assert ch_router._match_internal_user("+56999") is None


def test_admin_without_agent_scope_is_not_internal(monkeypatch):
    from app.features.channels import router as ch_router

    db = _phones_db(_verified_phone(), _admin_membership(admin_scope=["documents"]))
    _patch_db(monkeypatch, db, "app.features.channels.router")
    assert ch_router._match_internal_user("+56999") is None


def test_admin_with_agent_scope_is_internal(monkeypatch):
    from app.features.channels import router as ch_router

    db = _phones_db(_verified_phone(), _admin_membership(admin_scope=["agent", "inbox"]))
    _patch_db(monkeypatch, db, "app.features.channels.router")
    assert ch_router._match_internal_user("+56999") is not None


def test_inactive_membership_is_not_internal(monkeypatch):
    from app.features.channels import router as ch_router

    db = _phones_db(_verified_phone(), _admin_membership(is_active=False))
    _patch_db(monkeypatch, db, "app.features.channels.router")
    assert ch_router._match_internal_user("+56999") is None


def test_phone_without_membership_falls_back_to_profile(monkeypatch):
    from app.features.channels import router as ch_router

    db = _FakeDB(
        {
            "user_phones": [_verified_phone()],
            "tenant_memberships": [],
            "profiles": [{"id": "u1", "tenant_id": "t1", "role": "ADMIN", "admin_scope": [], "is_active": True}],
        }
    )
    _patch_db(monkeypatch, db, "app.features.channels.router")
    assert ch_router._match_internal_user("+56999") is not None


def test_phone_with_no_access_row_is_not_internal(monkeypatch):
    from app.features.channels import router as ch_router

    db = _phones_db(_verified_phone(), None)
    _patch_db(monkeypatch, db, "app.features.channels.router")
    assert ch_router._match_internal_user("+56999") is None


# ─────────────── fake supabase that honours filters ───────────────

_NOT_NULL = object()


class _Not:
    def __init__(self, query: _Query) -> None:
        self._query = query

    def is_(self, column: str, value: str):
        self._query.filters.append((column, _NOT_NULL if value == "null" else value))
        return self._query


class _Query:
    """Applies eq/not.is filters to canned rows and records writes."""

    def __init__(self, store: _FakeDB, table: str) -> None:
        self.store = store
        self.table = table
        self.filters: list[tuple[str, object]] = []
        self._single = False
        self._op = "select"
        self._payload: dict | None = None

    def select(self, *_a, **_k):
        self._op = "select"
        return self

    def insert(self, row: dict):
        self._op = "insert"
        self._payload = row
        return self

    def update(self, row: dict):
        self._op = "update"
        self._payload = row
        return self

    def eq(self, column: str, value):
        self.filters.append((column, value))
        return self

    def order(self, *_a, **_k):
        return self

    def limit(self, *_a, **_k):
        return self

    def single(self):
        self._single = True
        return self

    @property
    def not_(self):
        return _Not(self)

    def _matches(self, row: dict) -> bool:
        for column, expected in self.filters:
            if "->>" in column:
                jsonb, key = column.split("->>", 1)
                actual = (row.get(jsonb) or {}).get(key)
            else:
                actual = row.get(column)
            if expected is _NOT_NULL:
                if actual is None:
                    return False
            elif actual != expected:
                return False
        return True

    def execute(self):
        rows = [r for r in self.store.rows.get(self.table, []) if self._matches(r)]
        if self._op == "insert":
            row = {"id": f"{self.table}-{len(self.store.rows.get(self.table, [])) + 1}", **(self._payload or {})}
            self.store.rows.setdefault(self.table, []).append(row)
            self.store.inserts.append((self.table, self._payload or {}))
            rows = [row]
        elif self._op == "update":
            for row in rows:
                row.update(self._payload or {})
            self.store.updates.append((self.table, dict(self.filters), self._payload or {}))

        class R:
            pass

        result = R()
        result.data = (rows[0] if rows else None) if self._single else rows
        return result


class _FakeDB:
    def __init__(self, rows: dict[str, list[dict]] | None = None) -> None:
        self.rows = {k: [dict(r) for r in v] for k, v in (rows or {}).items()}
        self.inserts: list[tuple[str, dict]] = []
        self.updates: list[tuple[str, dict, dict]] = []

    def table(self, name: str):
        return _Query(self, name)


def _patch_db(monkeypatch, db: _FakeDB, *modules: str) -> None:
    for module in modules:
        monkeypatch.setattr(f"{module}.get_supabase_client", lambda: db)


# ─────────────── tenant routing (P1-08) ───────────────

TENANT_A = "aaaaaaaa-0000-0000-0000-000000000001"
TENANT_B = "bbbbbbbb-0000-0000-0000-000000000002"


def test_resolve_tenant_by_receiving_phone_number_id(monkeypatch):
    from app.features.channels import tenant_routing

    db = _FakeDB(
        {
            "tenants": [
                {"id": TENANT_A, "settings": {"kapso_phone_number_id": "111"}},
                {"id": TENANT_B, "settings": {"kapso_phone_number_id": "222"}},
            ]
        }
    )
    _patch_db(monkeypatch, db, "app.features.channels.tenant_routing")
    assert tenant_routing.resolve_tenant_id("222") == TENANT_B


def test_resolve_tenant_raises_when_unmapped_and_multi_tenant(monkeypatch):
    from app.features.channels import tenant_routing

    db = _FakeDB({"tenants": [{"id": TENANT_A, "settings": {}}, {"id": TENANT_B, "settings": {}}]})
    _patch_db(monkeypatch, db, "app.features.channels.tenant_routing")
    with pytest.raises(tenant_routing.TenantRoutingError):
        tenant_routing.resolve_tenant_id("999")


def test_resolve_tenant_falls_back_to_only_tenant(monkeypatch):
    from app.features.channels import tenant_routing

    db = _FakeDB({"tenants": [{"id": TENANT_A, "settings": {}}]})
    _patch_db(monkeypatch, db, "app.features.channels.tenant_routing")
    assert tenant_routing.resolve_tenant_id(None) == TENANT_A


def test_extract_phone_number_id_prefers_item_level():
    from app.features.channels import tenant_routing

    assert tenant_routing.extract_phone_number_id({"phone_number_id": "111"}) == "111"
    assert tenant_routing.extract_phone_number_id({"conversation": {"phone_number_id": "222"}}) == "222"
    assert tenant_routing.extract_phone_number_id({"message": {}}) is None


def test_contact_lookup_is_tenant_scoped(monkeypatch):
    """Same phone in two tenants: the receiving tenant's contact wins."""
    from app.features.channels import client_agent

    db = _FakeDB(
        {
            "contacts": [
                {"id": "contact-b", "tenant_id": TENANT_B, "phone": "+56911111111", "full_name": "Ajeno"},
                {"id": "contact-a", "tenant_id": TENANT_A, "phone": "+56911111111", "full_name": "Propio"},
            ]
        }
    )
    _patch_db(monkeypatch, db, "app.features.channels.client_agent")
    contact = client_agent._ensure_contact_from_phone(TENANT_A, "+56911111111")
    assert contact["id"] == "contact-a"


def test_unknown_phone_creates_contact_in_receiving_tenant(monkeypatch):
    from app.features.channels import client_agent

    db = _FakeDB({"contacts": [{"id": "contact-b", "tenant_id": TENANT_B, "phone": "+56922222222"}]})
    _patch_db(monkeypatch, db, "app.features.channels.client_agent")
    contact = client_agent._ensure_contact_from_phone(TENANT_A, "+56922222222", "Nuevo")
    assert contact["tenant_id"] == TENANT_A
    assert db.inserts[0][0] == "contacts"


def test_conversation_lookup_is_tenant_scoped(monkeypatch):
    from app.features.channels import client_agent

    db = _FakeDB(
        {
            "client_conversations": [
                {"id": "conv-b", "tenant_id": TENANT_B, "contact_id": "contact-1", "source": "whatsapp"}
            ]
        }
    )
    _patch_db(monkeypatch, db, "app.features.channels.client_agent")
    conv = client_agent._ensure_conversation(TENANT_A, {"id": "contact-1", "tenant_id": TENANT_A}, "+569", None)
    assert conv["tenant_id"] == TENANT_A
    assert conv["id"] != "conv-b"


def test_default_tenant_resolver_is_gone():
    from app.features.channels import client_agent

    assert not hasattr(client_agent, "_resolve_default_tenant")


# ─────────────── opt-out (P1-10) ───────────────


def test_opt_out_keywords_match_whole_message():
    from app.features.channels import client_agent

    for text in ("STOP", "baja", "Salir.", "  ELIMINAR  ", "cancelar", "unsubscribe"):
        assert client_agent.is_opt_out_request(text) is True


def test_opt_out_phrases_match_anywhere():
    from app.features.channels import client_agent

    for text in (
        "por favor dar de baja mi número",
        "No me escriban más",
        "quiero que eliminen mis datos",
        "revoco mi consentimiento para whatsapp",
    ):
        assert client_agent.is_opt_out_request(text) is True


def test_ordinary_messages_are_not_opt_out():
    from app.features.channels import client_agent

    for text in (
        "quiero cancelar la visita del martes",
        "hola, me interesa el depto de Ñuñoa",
        "puedo salir a verlo mañana?",
        "",
    ):
        assert client_agent.is_opt_out_request(text) is False


def test_inbound_reply_does_not_revive_revoked_consent(monkeypatch):
    """A revoked contact stays revoked no matter what they answer."""
    from app.features.channels import client_agent

    db = _FakeDB(
        {
            "client_consents": [
                {
                    "id": "consent-1",
                    "tenant_id": TENANT_A,
                    "contact_id": "contact-1",
                    "channel": "whatsapp",
                    "opted_in_at": None,
                    "opted_out_at": "2026-08-01T00:00:00+00:00",
                }
            ]
        }
    )
    _patch_db(monkeypatch, db, "app.features.channels.client_agent")
    client_agent._record_inbound_consent(TENANT_A, "contact-1")

    consent = db.rows["client_consents"][0]
    assert consent["opted_out_at"] == "2026-08-01T00:00:00+00:00"
    assert consent["opted_in_at"] is None
    assert db.updates == []


def test_first_inbound_still_records_opt_in(monkeypatch):
    from app.features.channels import client_agent

    db = _FakeDB({"client_consents": []})
    _patch_db(monkeypatch, db, "app.features.channels.client_agent")
    client_agent._record_inbound_consent(TENANT_A, "contact-1")

    assert db.inserts[0][0] == "client_consents"
    assert db.inserts[0][1]["opted_in_at"]


def test_record_opt_out_revokes_existing_consent(monkeypatch):
    from app.features.channels import client_agent

    db = _FakeDB(
        {
            "client_consents": [
                {
                    "id": "consent-1",
                    "tenant_id": TENANT_A,
                    "contact_id": "contact-1",
                    "channel": "whatsapp",
                    "opted_in_at": "2026-07-01T00:00:00+00:00",
                    "opted_out_at": None,
                }
            ]
        }
    )
    _patch_db(monkeypatch, db, "app.features.channels.client_agent")
    client_agent._record_opt_out(TENANT_A, "contact-1")

    consent = db.rows["client_consents"][0]
    assert consent["opted_in_at"] is None
    assert consent["opted_out_at"]


def test_opt_out_message_confirms_and_skips_the_llm(monkeypatch):
    """STOP must revoke, answer with the confirmation, and never reach the LLM."""
    import asyncio

    from app.features.channels import client_agent

    db = _FakeDB(
        {
            "contacts": [{"id": "contact-1", "tenant_id": TENANT_A, "phone": "+56911111111"}],
            "client_conversations": [
                {
                    "id": "conv-1",
                    "tenant_id": TENANT_A,
                    "contact_id": "contact-1",
                    "source": "whatsapp",
                    "ai_enabled": True,
                    "status": "open",
                }
            ],
            "client_consents": [],
        }
    )
    _patch_db(monkeypatch, db, "app.features.channels.client_agent")

    sent: list[str] = []

    async def _fake_send_text(_phone, text):
        sent.append(text)
        return {"messages": [{"id": "wamid.out"}]}

    async def _explode(*_a, **_k):
        raise AssertionError("LLM must not be called on an opt-out message")

    monkeypatch.setattr(client_agent.kapso_client, "send_text", _fake_send_text)
    monkeypatch.setattr(client_agent, "_generate_reply", _explode)

    asyncio.run(
        client_agent.handle_inbound_client(
            tenant_id=TENANT_A,
            phone_e164="+56911111111",
            user_text="BAJA",
            external_message_id="wamid.in",
            external_thread_id="thread-1",
        )
    )

    assert sent == [client_agent.OPT_OUT_REPLY]
    consent = db.rows["client_consents"][0]
    assert consent["opted_out_at"]
    assert consent["opted_in_at"] is None
