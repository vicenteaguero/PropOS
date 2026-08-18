"""The sync must say *why* it did nothing instead of returning an empty run."""

from __future__ import annotations

from unittest.mock import patch

import pytest

from app.core.config import settings as settings_module
from app.features.email_sync import sync as sync_module


def _configure(monkeypatch, **overrides):
    defaults = {
        "email_sync_enabled": True,
        "email_sync_tenant_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "email_imap_user": "buzon@unne.cl",
        "email_imap_password": "s3cret",
    }
    defaults.update(overrides)
    for key, value in defaults.items():
        monkeypatch.setattr(settings_module.settings, key, value, raising=False)


def test_missing_settings_lists_env_names(monkeypatch):
    _configure(monkeypatch, email_sync_enabled=False, email_imap_password="")

    assert sync_module.missing_settings() == ["EMAIL_SYNC_ENABLED", "EMAIL_IMAP_PASSWORD"]


def test_fully_configured_reports_nothing_missing(monkeypatch):
    _configure(monkeypatch)

    assert sync_module.missing_settings() == []


@pytest.mark.asyncio
async def test_disabled_run_names_the_missing_keys(monkeypatch):
    _configure(monkeypatch, email_sync_enabled=False, email_sync_tenant_id="")

    out = await sync_module.run_all_active_accounts()

    assert out["skipped"] is True
    assert out["missing"] == ["EMAIL_SYNC_ENABLED", "EMAIL_SYNC_TENANT_ID"]
    assert out["fetched"] == 0


@pytest.mark.asyncio
async def test_disabled_run_logs_a_warning_with_the_gap(monkeypatch):
    _configure(monkeypatch, email_imap_user="")

    with patch.object(sync_module.logger, "warning") as warn:
        await sync_module.run_all_active_accounts()

    assert warn.call_args[0][0] == "email_sync_disabled"
    assert warn.call_args[1]["missing"] == ["EMAIL_IMAP_USER"]


@pytest.mark.asyncio
async def test_configured_run_reports_the_failure_reason(monkeypatch):
    _configure(monkeypatch)

    with (
        patch.object(sync_module, "get_supabase_client"),
        patch.object(sync_module, "_ensure_account", return_value={"id": "acc-1"}),
        patch("anyio.to_thread.run_sync", side_effect=OSError("imap unreachable")),
    ):
        out = await sync_module.run_all_active_accounts()

    assert out["fetched"] == 0
    assert "imap unreachable" in out["error"]
