"""Per-tenant feature state: resolution precedence and the API gate.

The stub models the shape the real query returns -- a flat list of rows for BOTH
the tenant and the global default -- because the precedence bug this guards
against is invisible to a stub that hands back one row at a time.
"""

from __future__ import annotations

from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.core import features
from app.core.dependencies import require_feature

TENANT = str(uuid4())
OTHER_TENANT = str(uuid4())


class _Query:
    def __init__(self, rows: list[dict]):
        self._rows = rows

    def select(self, *_args, **_kwargs):
        return self

    def or_(self, _expr):
        return self

    def execute(self):
        return type("Resp", (), {"data": self._rows})()


class _Client:
    def __init__(self, rows: list[dict]):
        self._rows = rows

    def table(self, _name):
        return _Query(self._rows)


@pytest.fixture(autouse=True)
def _clear_cache():
    features.reset_cache()
    yield
    features.reset_cache()


@pytest.fixture
def rows(monkeypatch: pytest.MonkeyPatch):
    store: list[dict] = []
    monkeypatch.setattr(features, "_client", lambda: _Client(store))
    return store


def test_a_second_resolve_does_not_hit_the_database(monkeypatch: pytest.MonkeyPatch):
    """require_feature sits on most routers, so this must not be a query each time."""
    calls = {"n": 0}

    class _Counting(_Client):
        def table(self, name):
            calls["n"] += 1
            return super().table(name)

    monkeypatch.setattr(features, "_client", lambda: _Counting([]))
    features.resolve_states(TENANT)
    features.resolve_states(TENANT)
    assert calls["n"] == 1


def test_each_tenant_is_cached_separately(monkeypatch: pytest.MonkeyPatch):
    calls = {"n": 0}

    class _Counting(_Client):
        def table(self, name):
            calls["n"] += 1
            return super().table(name)

    monkeypatch.setattr(features, "_client", lambda: _Counting([]))
    features.resolve_states(TENANT)
    features.resolve_states(OTHER_TENANT)
    assert calls["n"] == 2


def test_an_unconfigured_key_is_on(rows):
    resolved = features.resolve_states(TENANT)
    assert resolved["crm"] == {"state": "on", "note": None}
    assert set(resolved) == set(features.KEYS)


def test_a_tenant_row_wins_over_the_global_default(rows):
    rows.extend(
        [
            {"tenant_id": None, "key": "conversaciones", "state": "hidden", "note": "global"},
            {"tenant_id": TENANT, "key": "conversaciones", "state": "on", "note": None},
        ]
    )
    assert features.resolve_states(TENANT)["conversaciones"]["state"] == "on"


def test_the_global_default_applies_without_a_tenant_row(rows):
    rows.append({"tenant_id": None, "key": "portales", "state": "locked", "note": "Falta el API"})
    entry = features.resolve_states(TENANT)["portales"]
    assert entry == {"state": "locked", "note": "Falta el API"}


def test_row_order_does_not_decide_the_winner(rows):
    """The tenant row must win even when the global row arrives after it.

    PostgREST makes no ordering promise, so a resolver that simply took the last
    row it saw would be right roughly half the time -- the kind of bug that
    looks like flakiness rather than logic.
    """
    rows.extend(
        [
            {"tenant_id": TENANT, "key": "finanzas", "state": "wip", "note": None},
            {"tenant_id": None, "key": "finanzas", "state": "hidden", "note": None},
        ]
    )
    assert features.resolve_states(TENANT)["finanzas"]["state"] == "wip"


def test_a_key_retired_from_the_catalog_is_ignored(rows):
    rows.append({"tenant_id": TENANT, "key": "nolongerexists", "state": "hidden", "note": None})
    assert "nolongerexists" not in features.resolve_states(TENANT)


@pytest.mark.asyncio
@pytest.mark.parametrize("state", ["locked", "hidden"])
async def test_require_feature_refuses_with_423(rows, state):
    rows.append({"tenant_id": TENANT, "key": "crm", "state": state, "note": "Todavía no"})
    checker = require_feature("crm")
    with pytest.raises(HTTPException) as excinfo:
        await checker(current_user={"id": "u", "tenant_id": TENANT})
    assert excinfo.value.status_code == 423
    assert excinfo.value.detail == "Todavía no"


@pytest.mark.asyncio
@pytest.mark.parametrize("state", ["on", "wip"])
async def test_require_feature_allows_on_and_wip(rows, state):
    """`wip` passing is the point: a half-built feature has to be exercisable."""
    rows.append({"tenant_id": TENANT, "key": "crm", "state": state, "note": None})
    checker = require_feature("crm")
    user = {"id": "u", "tenant_id": TENANT}
    assert await checker(current_user=user) is user


@pytest.mark.asyncio
async def test_require_feature_falls_back_to_a_spanish_message(rows):
    rows.append({"tenant_id": TENANT, "key": "crm", "state": "locked", "note": None})
    with pytest.raises(HTTPException) as excinfo:
        await require_feature("crm")(current_user={"id": "u", "tenant_id": TENANT})
    assert "disponible" in excinfo.value.detail


@pytest.mark.asyncio
async def test_an_unknown_key_never_blocks(rows):
    """A dependency naming a key the catalog dropped must fail open.

    Failing closed would mean a retired key silently 423s a working endpoint.
    """
    user = {"id": "u", "tenant_id": TENANT}
    assert await require_feature("nolongerexists")(current_user=user) is user
