"""Interaction filtering happens in the database, not after the fetch.

The old code took the newest `limit` interactions for the WHOLE tenant and then
kept the ones belonging to the person. In a tenant with 800 interactions and 250
people, almost every contact's last conversation falls outside the newest 100 —
so their timeline came back empty, which a broker reads as "we have never talked
to this person" rather than "this page does not reach that far back".
"""

from __future__ import annotations

from unittest.mock import patch
from uuid import uuid4

import pytest

from app.features.interactions.service import InteractionService

TENANT = uuid4()
PERSON = uuid4()
PROPERTY = uuid4()
OLD = str(uuid4())
RECENT = str(uuid4())


class _Builder:
    def __init__(self, rows: list[dict], log: list):
        self._rows = rows
        self._log = log

    def select(self, *_a, **_k):
        return self

    def eq(self, col, val):
        self._rows = [r for r in self._rows if str(r.get(col, val)) == str(val)]
        return self

    def is_(self, *_a, **_k):
        return self

    def order(self, *_a, **_k):
        return self

    def limit(self, n):
        # Deferred to execute(), like SQL: PostgREST applies LIMIT to the
        # filtered result, not to the rows before filtering. Truncating here
        # would model a database that does not exist and fail correct code.
        self._log.append(("limit", n))
        self._limit = n
        return self

    def in_(self, col, values):
        self._log.append(("in_", col, tuple(values)))
        self._rows = [r for r in self._rows if r.get(col) in values]
        return self

    _limit = None

    def execute(self):
        rows = self._rows[: self._limit] if self._limit is not None else self._rows
        return type("Res", (), {"data": rows})()


def _client(tables: dict[str, list[dict]], log: list | None = None):
    log = log if log is not None else []

    class _Client:
        def table(self, name):
            return _Builder([dict(r) for r in tables.get(name, [])], log)

    return _Client()


def _tables(**over):
    # 150 interactions newer than the person's only one, so a tenant-wide
    # `limit(100)` cannot reach it.
    noise = [{"id": str(uuid4()), "kind": "CALL"} for _ in range(150)]
    tables = {
        "interactions": [*noise, {"id": OLD, "kind": "CALL"}],
        "interaction_participants": [
            {"interaction_id": OLD, "person_id": str(PERSON)},
        ],
        "interaction_targets": [
            {"interaction_id": OLD, "property_id": str(PROPERTY)},
        ],
    }
    tables.update(over)
    return tables


@pytest.mark.asyncio
async def test_an_old_interaction_is_still_found_for_its_person():
    """The regression this replaces: it fell off the end of a tenant-wide page."""
    with patch("app.features.interactions.service.get_supabase_client", return_value=_client(_tables())):
        rows = await InteractionService.list_interactions(TENANT, person_id=PERSON)
    assert [r["id"] for r in rows] == [OLD]


@pytest.mark.asyncio
async def test_the_same_holds_for_a_property():
    with patch("app.features.interactions.service.get_supabase_client", return_value=_client(_tables())):
        rows = await InteractionService.list_interactions(TENANT, property_id=PROPERTY)
    assert [r["id"] for r in rows] == [OLD]


@pytest.mark.asyncio
async def test_both_filters_together_require_both_to_match():
    """Person AND property, not person OR property."""
    tables = _tables(
        interaction_targets=[{"interaction_id": RECENT, "property_id": str(PROPERTY)}],
    )
    with patch("app.features.interactions.service.get_supabase_client", return_value=_client(tables)):
        rows = await InteractionService.list_interactions(TENANT, person_id=PERSON, property_id=PROPERTY)
    assert rows == []


@pytest.mark.asyncio
async def test_a_person_with_no_interactions_short_circuits():
    """No ids means no query worth running — and `in_` with an empty list is a
    footgun that some clients turn into "match everything"."""
    log: list = []
    tables = _tables(interaction_participants=[])
    with patch("app.features.interactions.service.get_supabase_client", return_value=_client(tables, log)):
        rows = await InteractionService.list_interactions(TENANT, person_id=PERSON)
    assert rows == []
    assert not any(entry[0] == "in_" for entry in log)


@pytest.mark.asyncio
async def test_an_unfiltered_list_still_pages_the_tenant():
    """Without a filter the limit is the whole point — this must not turn into
    a full-table read."""
    log: list = []
    with patch("app.features.interactions.service.get_supabase_client", return_value=_client(_tables(), log)):
        rows = await InteractionService.list_interactions(TENANT, limit=10)
    assert len(rows) == 10
    assert ("limit", 10) in log


@pytest.mark.asyncio
async def test_participants_are_not_stripped_down_to_the_one_searched_for():
    """The timeline shows who else was in the conversation. Filtering through an
    embedded `!inner` would have returned only the matching participant."""
    tables = _tables(
        interactions=[
            {
                "id": OLD,
                "kind": "CALL",
                "interaction_participants": [
                    {"person_id": str(PERSON)},
                    {"person_id": str(uuid4())},
                ],
            }
        ]
    )
    with patch("app.features.interactions.service.get_supabase_client", return_value=_client(tables)):
        rows = await InteractionService.list_interactions(TENANT, person_id=PERSON)
    assert len(rows[0]["interaction_participants"]) == 2
