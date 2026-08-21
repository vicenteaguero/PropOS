"""An owner is linked to a property by a stakeholder row, not by a deal.

`owner_without_property` asked "does this person have an opportunity?" and
reported every no as "propietario sin propiedad". Owners are exactly the people
who usually have no deal of their own — they have a property — so the check
flagged nearly all of them, and a finding that is almost always wrong is one
nobody reads. `property_stakeholders` has existed since the Clientes rewrite.
"""

from __future__ import annotations

from unittest.mock import patch
from uuid import uuid4


from app.features.data_health.service import check_tenant

TENANT = uuid4()
OWNER = str(uuid4())


#: Columns each table actually has, for the purposes of "does this filter
#: reference something real". Only what the checks touch.
_COLUMNS = {
    "contacts": {"id", "type", "phone", "email", "tenant_id", "deleted_at"},
    "properties": {"id", "title", "status", "is_draft", "list_price_cents", "address", "tenant_id", "deleted_at"},
    "opportunities": {"id", "person_id", "property_id", "status", "tenant_id", "deleted_at"},
    # No `deleted_at`: a stakeholder link is deleted, not archived.
    "property_stakeholders": {"id", "contact_id", "property_id", "role", "tenant_id"},
    "media_assets": {"target_row_id", "target_table", "tenant_id"},
}


class _Builder:
    def __init__(self, rows: list[dict], table: str = ""):
        self._rows = rows
        self._table = table
        self._columns = _COLUMNS.get(table, set())

    def select(self, *_a, **_k):
        return self

    def eq(self, *_a, **_k):
        return self

    def is_(self, col, _value):
        # Postgres raises 42703 for a filter on a column that does not exist,
        # and PostgREST turns that into a 500 for the whole health check. The
        # stub used to accept any column, so `property_stakeholders.deleted_at`
        # — a column that has never existed — passed here and failed in
        # production. Model the failure.
        if col not in self._columns:
            raise AssertionError(f"filtered on {self._table}.{col}, which does not exist")
        return self

    def limit(self, *_a, **_k):
        return self

    def order(self, *_a, **_k):
        return self

    def range(self, *_a, **_k):
        return self

    def execute(self):
        return type("Res", (), {"data": self._rows})()


def _client(tables: dict[str, list[dict]]):
    class _Client:
        def table(self, name):
            return _Builder([dict(r) for r in tables.get(name, [])], name)

    return _Client()


def _tables(**over):
    tables = {
        "contacts": [{"id": OWNER, "type": "LANDOWNER", "phone": "+56900000000", "email": "o@x.cl"}],
        "properties": [],
        "opportunities": [],
        "property_stakeholders": [],
        "media_assets": [],
    }
    tables.update(over)
    return tables


def _count(findings, code: str) -> int:
    for f in findings:
        if f.code == code:
            return f.count
    return 0


def _findings(tables):
    with patch("app.features.data_health.service.get_supabase_client", return_value=_client(tables)):
        return check_tenant(TENANT).findings


def test_an_owner_with_a_stakeholder_row_is_not_flagged():
    """The whole point: the owner IS linked to a property, just not by a deal."""
    tables = _tables(property_stakeholders=[{"contact_id": OWNER, "role": "owner"}])
    assert _count(_findings(tables), "owner_without_property") == 0


def test_an_owner_linked_to_nothing_is_still_flagged():
    """The finding has to keep working, or fixing it would just delete it."""
    assert _count(_findings(_tables()), "owner_without_property") == 1


def test_an_owner_who_also_has_a_deal_is_not_flagged():
    """Either link counts."""
    tables = _tables(opportunities=[{"id": str(uuid4()), "person_id": OWNER, "status": "OPEN"}])
    assert _count(_findings(tables), "owner_without_property") == 0


def test_a_buyer_with_no_property_is_not_an_owner_finding():
    """Buyers are not expected to own anything."""
    tables = _tables(contacts=[{"id": str(uuid4()), "type": "BUYER", "phone": "+56900000000"}])
    assert _count(_findings(tables), "owner_without_property") == 0
