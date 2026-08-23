"""A workspace marked `dev_only` refuses everyone but a dev admin.

The demo workspace holds ~250 invented people and lives in the same database
production serves. Its access was closed only because nobody had been added to
`DEMO_ADMIN_EMAILS` -- an accident, one edit away from a broker opening the app
and finding a switcher full of fictional clients. This makes a stray membership
insufficient on its own.
"""

from __future__ import annotations

from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.features.memberships.service import _assert_dev_only_allowed

TENANT = uuid4()


class _Query:
    def __init__(self, rows):
        self._rows = rows

    def select(self, *_a, **_k):
        return self

    def eq(self, *_a, **_k):
        return self

    def limit(self, *_a, **_k):
        return self

    def execute(self):
        return type("R", (), {"data": self._rows})()


class _Client:
    def __init__(self, rows):
        self._rows = rows

    def table(self, _name):
        return _Query(self._rows)


DEV_ONLY = _Client([{"settings": {"dev_only": True}}])
NORMAL = _Client([{"settings": {"brand_color": "#BE6E7D"}}])


def test_a_dev_admin_gets_in():
    _assert_dev_only_allowed(DEV_ONLY, TENANT, {"is_dev_admin": True})


def test_a_plain_admin_is_refused_even_with_a_membership():
    """The membership check already passed; this is the second gate."""
    with pytest.raises(HTTPException) as excinfo:
        _assert_dev_only_allowed(DEV_ONLY, TENANT, {"is_dev_admin": False})
    assert excinfo.value.status_code == 403


def test_a_missing_flag_reads_as_not_dev_admin():
    with pytest.raises(HTTPException):
        _assert_dev_only_allowed(DEV_ONLY, TENANT, {})


def test_a_normal_tenant_is_untouched():
    _assert_dev_only_allowed(NORMAL, TENANT, {"is_dev_admin": False})


def test_an_empty_settings_blob_is_not_dev_only():
    _assert_dev_only_allowed(_Client([{"settings": None}]), TENANT, {"is_dev_admin": False})


def test_a_missing_tenant_row_does_not_block():
    """Fail open: a tenant that cannot be read is not a reason to lock everyone out."""
    _assert_dev_only_allowed(_Client([]), TENANT, {"is_dev_admin": False})
