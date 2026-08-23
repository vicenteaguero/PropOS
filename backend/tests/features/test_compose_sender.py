"""Which address a tenant's outbound mail is signed with.

`RESEND_FROM_EMAIL` is one global value and PropOS is multi-tenant, so the
platform address has to be the last resort rather than the default. Before this,
a tenant with no configured sender mailed its own clients signed as PropOS --
and, while the platform sender still lived on `anaida.cl`, signed as a different
brokerage entirely.
"""

from __future__ import annotations

from uuid import uuid4

import pytest

from app.features.email_sync import compose

TENANT = uuid4()


class _Query:
    def __init__(self, rows, boom=False):
        self._rows, self._boom = rows, boom

    def select(self, *_a, **_k):
        return self

    def eq(self, *_a, **_k):
        return self

    def limit(self, *_a, **_k):
        return self

    def execute(self):
        if self._boom:
            raise ConnectionError("no database")
        return type("R", (), {"data": self._rows})()


class _Client:
    def __init__(self, rows, boom=False):
        self._rows, self._boom = rows, boom

    def table(self, _name):
        return _Query(self._rows, self._boom)


@pytest.fixture(autouse=True)
def _platform(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(compose.settings, "resend_from_email", "PropOS <no-reply@propos.cl>")


def test_a_configured_tenant_signs_with_its_own_address():
    client = _Client([{"settings": {"email_from": "ANAIDA <contacto@anaida.cl>"}}])
    assert compose._sender_address(client, TENANT) == "contacto@anaida.cl"


def test_a_bare_address_needs_no_display_name():
    client = _Client([{"settings": {"email_from": "contacto@anaida.cl"}}])
    assert compose._sender_address(client, TENANT) == "contacto@anaida.cl"


def test_a_tenant_without_a_sender_falls_back_to_the_platform():
    client = _Client([{"settings": {"brand_color": "#BE6E7D"}}])
    assert compose._sender_address(client, TENANT) == "no-reply@propos.cl"


def test_an_empty_settings_blob_falls_back():
    assert compose._sender_address(_Client([{"settings": None}]), TENANT) == "no-reply@propos.cl"


def test_a_missing_tenant_row_falls_back():
    assert compose._sender_address(_Client([]), TENANT) == "no-reply@propos.cl"


def test_no_tenant_asked_about_means_the_platform_address():
    """Platform mail -- password resets, invitations -- has no tenant identity."""
    assert compose._sender_address() == "no-reply@propos.cl"


def test_a_database_failure_does_not_break_sending():
    """Sending is worth more than signing perfectly; degrade, do not raise."""
    assert compose._sender_address(_Client([], boom=True), TENANT) == "no-reply@propos.cl"


def test_the_display_name_is_stripped_from_the_platform_value():
    assert compose._platform_sender() == "no-reply@propos.cl"
