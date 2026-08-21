"""Publishing needs a price and a photo — checked before, not counted after.

`data_health` already reports published properties missing both, but a report
is an autopsy: the listing is public by then, a portal may have syndicated it,
and someone has already seen a blank card with no price.
"""

from __future__ import annotations

from unittest.mock import patch
from uuid import uuid4

import pytest

from app.features.properties.publish import NotPublishableError, assert_publishable
from app.features.properties.service import PropertyService

TENANT = uuid4()
PROP = uuid4()


class _Builder:
    def __init__(self, rows: list[dict], sink: list):
        self._rows = rows
        self._sink = sink

    def select(self, *_a, **_k):
        return self

    def eq(self, *_a, **_k):
        return self

    def is_(self, *_a, **_k):
        return self

    def limit(self, *_a, **_k):
        return self

    def single(self):
        return self

    def update(self, data):
        self._sink.append(data)
        return self

    def execute(self):
        data = self._rows[0] if len(self._rows) == 1 and self._single else self._rows
        return type("Res", (), {"data": data})()

    _single = False


class _SingleBuilder(_Builder):
    def single(self):
        self._single = True
        return self


def _client(tables: dict[str, list[dict]], sink: list | None = None):
    sink = sink if sink is not None else []

    class _Client:
        def table(self, name):
            return _SingleBuilder(list(tables.get(name, [])), sink)

    return _Client()


class _Payload:
    def __init__(self, **data):
        self._data = data

    def model_dump(self, exclude_unset=False):
        return dict(self._data)


def test_a_listing_with_a_price_and_a_photo_publishes():
    client = _client({"media_assets": [{"id": str(uuid4())}]})
    assert_publishable(client, TENANT, PROP, {"list_price_cents": 100})


def test_publishing_without_a_price_is_refused_in_words_the_broker_can_act_on():
    client = _client({"media_assets": [{"id": str(uuid4())}]})
    with pytest.raises(NotPublishableError) as err:
        assert_publishable(client, TENANT, PROP, {"list_price_cents": None})
    assert err.value.reasons == ["Falta el precio."]


def test_publishing_without_a_photo_is_refused():
    client = _client({"media_assets": []})
    with pytest.raises(NotPublishableError) as err:
        assert_publishable(client, TENANT, PROP, {"list_price_cents": 100})
    assert err.value.reasons == ["Falta al menos una foto."]


def test_both_reasons_are_reported_at_once():
    """Fixing one and being refused again for the other is two round trips for
    something the first answer already knew."""
    client = _client({"media_assets": []})
    with pytest.raises(NotPublishableError) as err:
        assert_publishable(client, TENANT, PROP, {})
    assert len(err.value.reasons) == 2


@pytest.mark.asyncio
async def test_a_draft_can_be_saved_incomplete():
    """Half-filled drafts are how properties get loaded. Refusing to save one
    would break the only workflow there is."""
    sink: list = []
    client = _client({"properties": [{"id": str(PROP), "is_draft": True}], "media_assets": []}, sink)
    with patch("app.features.properties.service.get_supabase_client", return_value=client):
        await PropertyService.update_property(PROP, _Payload(title="Sin precio ni fotos"), TENANT)
    assert sink == [{"title": "Sin precio ni fotos"}]


@pytest.mark.asyncio
async def test_the_check_reads_the_row_as_it_will_be_not_as_it_is():
    """Setting the price and publishing in one request has to work — otherwise
    the UI is forced into two saves to do one thing."""
    client = _client(
        {"properties": [{"id": str(PROP), "is_draft": True, "list_price_cents": None}], "media_assets": [{"id": "a"}]}
    )
    with patch("app.features.properties.service.get_supabase_client", return_value=client):
        await PropertyService.update_property(PROP, _Payload(is_draft=False, list_price_cents=100), TENANT)


@pytest.mark.asyncio
async def test_editing_an_already_published_listing_is_not_re_gated():
    """The guard is on the transition. Re-checking every edit would strand a
    listing that was published before the rule existed."""
    client = _client(
        {"properties": [{"id": str(PROP), "is_draft": False, "list_price_cents": None}], "media_assets": []}
    )
    with patch("app.features.properties.service.get_supabase_client", return_value=client):
        await PropertyService.update_property(PROP, _Payload(is_draft=False, title="Editado"), TENANT)
