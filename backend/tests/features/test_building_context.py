"""The building a unit sits in — the group `properties.address` could not form.

`address` is free text, so forty flats in one tower become forty spellings of
one street. Nothing could then price them against each other, notice the same
building being photographed forty times, or answer the first question a buyer
asks: what else do you have here.
"""

from __future__ import annotations

from unittest.mock import patch
from uuid import uuid4

import pytest

from app.features.properties.service import PropertyService

TENANT = uuid4()
BUILDING = str(uuid4())
UNIT = str(uuid4())


class _Builder:
    def __init__(self, rows: list[dict], log: list):
        self._rows = rows
        self._log = log

    def select(self, *_a, **_k):
        return self

    def eq(self, col, val):
        self._log.append(("eq", col, val))
        self._rows = [r for r in self._rows if str(r.get(col, val)) == str(val)]
        return self

    def neq(self, col, val):
        self._rows = [r for r in self._rows if str(r.get(col)) != str(val)]
        return self

    def is_(self, *_a, **_k):
        return self

    def order(self, *_a, **_k):
        return self

    def limit(self, *_a, **_k):
        return self

    def execute(self):
        return type("Res", (), {"data": self._rows})()


def _client(tables: dict[str, list[dict]], log: list | None = None):
    log = log if log is not None else []

    class _Client:
        def table(self, name):
            return _Builder([dict(r) for r in tables.get(name, [])], log)

    return _Client()


def _tables(**over):
    tables = {
        "properties": [
            {"id": UNIT, "building_id": BUILDING, "title": "Depto 402", "status": "AVAILABLE"},
            {"id": str(uuid4()), "building_id": BUILDING, "title": "Depto 501", "status": "AVAILABLE"},
        ],
        "buildings": [{"id": BUILDING, "name": "Edificio Parque Ñuñoa", "shared": {"gastos_comunes": 90000}}],
    }
    tables.update(over)
    return tables


@pytest.mark.asyncio
async def test_a_standalone_house_has_no_building():
    """Most of the inventory. Null, not an empty shell the page has to render."""
    tables = _tables(properties=[{"id": UNIT, "building_id": None}])
    with patch("app.features.properties.service.get_supabase_client", return_value=_client(tables)):
        assert await PropertyService.get_building_context(TENANT, UNIT) is None


@pytest.mark.asyncio
async def test_the_unit_being_viewed_is_not_listed_among_its_own_siblings():
    """ "Otras unidades" that includes this one is a bug the eye catches instantly."""
    with patch("app.features.properties.service.get_supabase_client", return_value=_client(_tables())):
        ctx = await PropertyService.get_building_context(TENANT, UNIT)
    assert ctx is not None
    assert [u["title"] for u in ctx["units"]] == ["Depto 501"]


@pytest.mark.asyncio
async def test_shared_attributes_come_from_the_building_not_the_unit():
    """Gastos comunes and amenities are the building's, entered once."""
    with patch("app.features.properties.service.get_supabase_client", return_value=_client(_tables())):
        ctx = await PropertyService.get_building_context(TENANT, UNIT)
    assert ctx["shared"]["gastos_comunes"] == 90000


@pytest.mark.asyncio
async def test_every_read_is_scoped_to_the_tenant():
    """Three separate reads. A building leaking siblings across tenants would
    publish one client's inventory inside another's."""
    log: list = []
    with patch("app.features.properties.service.get_supabase_client", return_value=_client(_tables(), log)):
        await PropertyService.get_building_context(TENANT, UNIT)
    reads = [c for c in log if c[1] == "tenant_id"]
    assert len(reads) == 3
    assert all(val == str(TENANT) for _, _, val in reads)


@pytest.mark.asyncio
async def test_a_building_from_another_tenant_is_not_resolved():
    """The unit's `building_id` is attacker-adjacent data: it is whatever the row
    says. Following it without re-checking the tenant is how the join leaks."""
    tables = _tables(buildings=[{"id": BUILDING, "tenant_id": str(uuid4()), "name": "Ajeno", "shared": {}}])
    with patch("app.features.properties.service.get_supabase_client", return_value=_client(tables)):
        assert await PropertyService.get_building_context(TENANT, UNIT) is None
