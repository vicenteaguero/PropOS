"""A deal card names one person and one property; many deals have more.

`opportunities.person_id` / `property_id` are the PRINCIPAL ones — the N:M
tables `opportunity_participants` and `opportunity_properties` hold the rest.
A card that names only the principal is not shorthand for a two-buyer deal, it
is a wrong statement about it, and nothing on the board hinted otherwise.
"""

from __future__ import annotations

from unittest.mock import patch
from uuid import uuid4

import pytest

from app.features.opportunities.service import OpportunityService

TENANT = uuid4()


class _Builder:
    def __init__(self, rows: list[dict]):
        self._rows = rows

    def select(self, *_a, **_k):
        return self

    def eq(self, *_a, **_k):
        return self

    def is_(self, *_a, **_k):
        return self

    def order(self, *_a, **_k):
        return self

    def range(self, *_a, **_k):
        return self

    def execute(self):
        return type("Res", (), {"data": self._rows})()


def _client(rows: list[dict]):
    class _Client:
        def table(self, _name):
            return _Builder([dict(r) for r in rows])

    return _Client()


def _opp(participants: int, properties: int):
    """PostgREST returns an embedded count as `[{"count": n}]`."""
    return {
        "id": str(uuid4()),
        "opportunity_participants": [{"count": participants}],
        "opportunity_properties": [{"count": properties}],
    }


async def _list(rows):
    with patch("app.features.opportunities.service.get_supabase_client", return_value=_client(rows)):
        return await OpportunityService.list_opportunities(TENANT)


@pytest.mark.asyncio
async def test_a_single_party_deal_reports_no_extras():
    """The card already names them. "+0" would be noise on most of the board."""
    row = (await _list([_opp(1, 1)]))[0]
    assert (row["extra_participants"], row["extra_properties"]) == (0, 0)


@pytest.mark.asyncio
async def test_extras_are_counted_beyond_the_one_shown():
    """Four participants, one named on the card, so "+3" — not "+4"."""
    row = (await _list([_opp(4, 3)]))[0]
    assert (row["extra_participants"], row["extra_properties"]) == (3, 2)


@pytest.mark.asyncio
async def test_a_deal_with_no_join_rows_at_all_does_not_go_negative():
    """Older deals predate the N:M tables and embed an empty list."""
    row = (await _list([{"id": str(uuid4()), "opportunity_participants": [], "opportunity_properties": []}]))[0]
    assert (row["extra_participants"], row["extra_properties"]) == (0, 0)


@pytest.mark.asyncio
async def test_the_raw_embeds_do_not_leak_into_the_response():
    """The response model declares two ints; leaving the embeds would ship
    PostgREST's shape to the client."""
    row = (await _list([_opp(2, 2)]))[0]
    assert "opportunity_participants" not in row
    assert "opportunity_properties" not in row
