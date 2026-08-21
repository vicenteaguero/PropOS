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
    """Models the bit of PostgREST this code depends on.

    Notably: a dotted filter like `interaction_participants.person_id` only
    applies when that relation is embedded with `!inner`, and it restricts the
    PARENT rows. That is the whole mechanism under test, so the stub has to
    implement it rather than ignore it.
    """

    def __init__(self, rows: list[dict], log: list):
        self._rows = rows
        self._log = log
        self._limit: int | None = None
        self._inner: set[str] = set()

    def select(self, spec="*", *_a, **_k):
        self._inner = {part.split("!inner")[0].strip() for part in spec.split(",") if "!inner" in part}
        self._log.append(("select", spec))
        return self

    def eq(self, col, val):
        if "." in col:
            relation, field = col.split(".", 1)
            if relation not in self._inner:
                raise AssertionError(f"filtered on {col} without embedding {relation} as !inner")
            self._rows = [
                r for r in self._rows if any(str(child.get(field)) == str(val) for child in r.get(relation, []))
            ]
        else:
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

    def execute(self):
        rows = self._rows[: self._limit] if self._limit is not None else self._rows
        return type("Res", (), {"data": rows})()


def _client(tables: dict[str, list[dict]], log: list | None = None):
    log = log if log is not None else []

    class _Client:
        def table(self, name):
            return _Builder([dict(r) for r in tables.get(name, [])], log)

    return _Client()


def _interaction(iid: str, *, people: list[str] = (), properties: list[str] = ()):
    return {
        "id": iid,
        "kind": "CALL",
        "interaction_participants": [{"person_id": p} for p in people],
        "interaction_targets": [{"property_id": p} for p in properties],
    }


def _tables(**over):
    # 150 interactions newer than the person's only one, so a tenant-wide
    # `limit(100)` cannot reach it.
    noise = [_interaction(str(uuid4())) for _ in range(150)]
    tables = {"interactions": [*noise, _interaction(OLD, people=[str(PERSON)], properties=[str(PROPERTY)])]}
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
    # The person is on one interaction, the property on a different one.
    tables = _tables(
        interactions=[
            _interaction(OLD, people=[str(PERSON)]),
            _interaction(RECENT, properties=[str(PROPERTY)]),
        ]
    )
    with patch("app.features.interactions.service.get_supabase_client", return_value=_client(tables)):
        rows = await InteractionService.list_interactions(TENANT, person_id=PERSON, property_id=PROPERTY)
    assert rows == []


@pytest.mark.asyncio
async def test_a_person_with_no_interactions_short_circuits():
    """No ids means no query worth running — and `in_` with an empty list is a
    footgun that some clients turn into "match everything"."""
    log: list = []
    tables = _tables(interactions=[_interaction(OLD)])
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
    tables = _tables(interactions=[_interaction(OLD, people=[str(PERSON), str(uuid4())])])
    with patch("app.features.interactions.service.get_supabase_client", return_value=_client(tables)):
        rows = await InteractionService.list_interactions(TENANT, person_id=PERSON)
    assert len(rows[0]["participants"]) == 2


@pytest.mark.asyncio
async def test_the_id_list_sent_back_is_bounded_by_the_page_size():
    """A person with thousands of interactions must not produce a request whose
    query string is thousands of UUIDs long — PostgREST would reject the URL,
    and the timeline would fail exactly for the busiest contacts.

    The first query is what bounds it: it pages the ids, so at most `limit` of
    them ever reach the `in_`.
    """
    log: list = []
    busy = [_interaction(str(uuid4()), people=[str(PERSON)]) for _ in range(5000)]
    with patch(
        "app.features.interactions.service.get_supabase_client",
        return_value=_client(_tables(interactions=busy), log),
    ):
        await InteractionService.list_interactions(TENANT, person_id=PERSON, limit=50)
    sent = [entry for entry in log if entry[0] == "in_"]
    assert len(sent) == 1
    assert len(sent[0][2]) <= 50


@pytest.mark.asyncio
async def test_the_response_carries_who_was_there_and_what_it_was_about():
    """PostgREST names the embeds `interaction_participants`/`interaction_targets`;
    the response model declares `participants`/`targets` with a default of `[]`.
    Without the rename FastAPI dropped both and served empty lists — so the list
    endpoint never once returned a participant, and the default made that look
    like there simply were none.
    """
    tables = _tables(interactions=[_interaction(OLD, people=[str(PERSON)], properties=[str(PROPERTY)])])
    with patch("app.features.interactions.service.get_supabase_client", return_value=_client(tables)):
        rows = await InteractionService.list_interactions(TENANT, person_id=PERSON)
    assert rows[0]["participants"] == [{"person_id": str(PERSON)}]
    assert rows[0]["targets"] == [{"property_id": str(PROPERTY)}]
    assert "interaction_participants" not in rows[0]
