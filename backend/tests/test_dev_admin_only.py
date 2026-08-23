"""`DEV_ADMIN_ONLY` closes a whole deployment to non-developer accounts.

Staging (`dev.propos.cl`) runs branch code against the SAME database production
serves. The separation therefore cannot be the data -- it has to be who reaches
it. Without this, any broker who typed the staging URL would be using
half-finished code on the brokerage's real rows.

Gated inside `get_current_user` rather than per-route on purpose: an endpoint
written next month is covered without anyone remembering to gate it.
"""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.core import dependencies


@pytest.fixture
def profile():
    return {
        "id": "aea6d8db-91f5-46dc-b106-546b9f254078",
        "role": "ADMIN",
        "tenant_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "is_active": True,
        "admin_scope": [],
        "view": "admin",
    }


def _gate(profile: dict) -> None:
    """The check exactly as `get_current_user` runs it."""
    from app.core.config.settings import settings

    if settings.dev_admin_only and not profile.get("is_dev_admin"):
        raise HTTPException(status_code=403, detail="This environment is restricted to developer accounts")


def test_production_lets_everyone_through(profile, monkeypatch: pytest.MonkeyPatch):
    """The flag is off in production, so a plain broker is unaffected."""
    monkeypatch.setattr(dependencies.settings, "dev_admin_only", False)
    profile["is_dev_admin"] = False
    _gate(profile)


def test_staging_refuses_a_plain_admin(profile, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(dependencies.settings, "dev_admin_only", True)
    profile["is_dev_admin"] = False
    with pytest.raises(HTTPException) as excinfo:
        _gate(profile)
    assert excinfo.value.status_code == 403


def test_staging_lets_the_dev_admin_through(profile, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(dependencies.settings, "dev_admin_only", True)
    profile["is_dev_admin"] = True
    _gate(profile)


def test_a_missing_flag_is_refused_not_assumed(profile, monkeypatch: pytest.MonkeyPatch):
    """`is_dev_admin` is merged in from tenant_memberships and can be absent.

    Absent must read as "not a developer". Defaulting the other way would open
    staging to exactly the accounts it exists to keep out.
    """
    monkeypatch.setattr(dependencies.settings, "dev_admin_only", True)
    profile.pop("is_dev_admin", None)
    with pytest.raises(HTTPException):
        _gate(profile)


def test_the_setting_defaults_to_off():
    """A deployment that forgets the variable must behave like production."""
    from app.core.config.settings import Settings

    assert Settings.model_fields["dev_admin_only"].default is False
