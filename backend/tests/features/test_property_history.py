"""Price and status history — recorded since 2024, never once displayed.

`property_snapshots` stores `to_jsonb(OLD)`: the row BEFORE each change. A
snapshot therefore says where a value came from and nothing about where it
went. Turning that into "de $180.000.000 a $171.900.000" means stitching each
snapshot to the next-newer one, with the live row closing the chain.
"""

from __future__ import annotations

from unittest.mock import patch
from uuid import uuid4

import pytest

from app.features.properties.service import PropertyService

TENANT = uuid4()
PROP = str(uuid4())


class _Builder:
    def __init__(self, rows: list[dict]):
        self._rows = rows

    def select(self, *_a, **_k):
        return self

    def eq(self, col, val):
        self._rows = [r for r in self._rows if str(r.get(col, val)) == str(val)]
        return self

    def order(self, col, desc=False):
        self._rows = sorted(self._rows, key=lambda r: r.get(col) or "", reverse=desc)
        return self

    def limit(self, *_a, **_k):
        return self

    def execute(self):
        return type("Res", (), {"data": self._rows})()


def _client(tables):
    class _Client:
        def table(self, name):
            return _Builder([dict(r) for r in tables.get(name, [])])

    return _Client()


def _snap(at: str, trigger: str, **before):
    return {"snapshot_at": at, "trigger": trigger, "snapshot_data": before}


@pytest.mark.asyncio
async def test_a_property_that_never_moved_has_an_empty_history():
    """The honest answer. Inventing a baseline entry would claim a change
    that never happened."""
    tables = {"properties": [{"id": PROP, "list_price_cents": 100, "status": "AVAILABLE"}]}
    with patch("app.features.properties.service.get_supabase_client", return_value=_client(tables)):
        assert await PropertyService.get_price_history(TENANT, PROP) == []


@pytest.mark.asyncio
async def test_the_newest_change_lands_on_the_live_price():
    """The most recent snapshot's destination is the row as it stands now —
    there is no newer snapshot to read it from."""
    tables = {
        "properties": [{"id": PROP, "list_price_cents": 171_900_000_00, "status": "AVAILABLE"}],
        "property_snapshots": [
            _snap("2026-08-01T10:00:00Z", "price_change", list_price_cents=180_000_000_00, status="AVAILABLE")
        ],
    }
    with patch("app.features.properties.service.get_supabase_client", return_value=_client(tables)):
        history = await PropertyService.get_price_history(TENANT, PROP)
    assert len(history) == 1
    assert history[0]["price_from_cents"] == 180_000_000_00
    assert history[0]["price_to_cents"] == 171_900_000_00


@pytest.mark.asyncio
async def test_each_older_change_lands_on_the_next_one_it_was_replaced_by():
    """The chain, not a list of orphaned old rows. Two drops must read as
    200 → 180 → 172, never as two changes that both end at today's price."""
    tables = {
        "properties": [{"id": PROP, "list_price_cents": 172, "status": "AVAILABLE"}],
        "property_snapshots": [
            _snap("2026-08-01T10:00:00Z", "price_change", list_price_cents=180, status="AVAILABLE"),
            _snap("2026-06-01T10:00:00Z", "price_change", list_price_cents=200, status="AVAILABLE"),
        ],
    }
    with patch("app.features.properties.service.get_supabase_client", return_value=_client(tables)):
        history = await PropertyService.get_price_history(TENANT, PROP)
    assert [(h["price_from_cents"], h["price_to_cents"]) for h in history] == [(180, 172), (200, 180)]


@pytest.mark.asyncio
async def test_status_changes_carry_their_own_before_and_after():
    tables = {
        "properties": [{"id": PROP, "list_price_cents": 100, "status": "SOLD"}],
        "property_snapshots": [_snap("2026-08-01T10:00:00Z", "status_change", list_price_cents=100, status="RESERVED")],
    }
    with patch("app.features.properties.service.get_supabase_client", return_value=_client(tables)):
        history = await PropertyService.get_price_history(TENANT, PROP)
    assert (history[0]["status_from"], history[0]["status_to"]) == ("RESERVED", "SOLD")


@pytest.mark.asyncio
async def test_a_property_from_another_tenant_yields_nothing():
    tables = {"properties": [], "property_snapshots": [_snap("2026-08-01T10:00:00Z", "price_change")]}
    with patch("app.features.properties.service.get_supabase_client", return_value=_client(tables)):
        assert await PropertyService.get_price_history(TENANT, PROP) == []
