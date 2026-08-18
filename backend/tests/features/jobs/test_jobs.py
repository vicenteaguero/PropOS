"""Internal job endpoint auth (shared-secret header gate) + runner behaviour."""

from unittest.mock import MagicMock, patch

import pytest

from app.core.config import settings as settings_module
from app.features.jobs import service as jobs_service

JOBS_PATH = "/api/v1/internal/jobs/run-due-reminders"
ANALYTICS_PATH = "/api/v1/internal/jobs/refresh-analytics"


def _reminders_table(due: list[dict] | None = None, claimed: list[dict] | None = None) -> MagicMock:
    """Stub whose execute() answers recover → select-due → claim, then updates."""
    table = MagicMock()
    for method in ("update", "select", "eq", "lte", "lt", "is_", "in_", "order", "limit"):
        getattr(table, method).return_value = table
    table.execute.side_effect = [
        MagicMock(data=[]),  # recover stuck
        MagicMock(data=due or []),  # select due ids
        *([MagicMock(data=claimed or due or [])] if due else []),  # claim
        *[MagicMock(data=[{}]) for _ in (claimed or due or [])],  # per-row status update
    ]
    return table


@pytest.mark.asyncio
async def test_jobs_503_when_secret_unset(client, monkeypatch):
    monkeypatch.setattr(settings_module.settings, "internal_jobs_secret", "", raising=False)
    response = await client.post(JOBS_PATH)
    assert response.status_code == 503


@pytest.mark.asyncio
async def test_jobs_403_on_wrong_key(client, monkeypatch):
    monkeypatch.setattr(settings_module.settings, "internal_jobs_secret", "s3cret", raising=False)
    response = await client.post(JOBS_PATH, headers={"X-Internal-Key": "nope"})
    assert response.status_code == 403


@pytest.mark.asyncio
@patch("app.features.jobs.service.get_supabase_client")
async def test_jobs_200_on_correct_key(mock_client, client, monkeypatch):
    monkeypatch.setattr(settings_module.settings, "internal_jobs_secret", "s3cret", raising=False)
    mock_client.return_value.table.return_value = _reminders_table()

    response = await client.post(JOBS_PATH, headers={"X-Internal-Key": "s3cret"})

    assert response.status_code == 200
    assert response.json() == {"sent": 0, "failed": 0, "recovered": 0, "claimed": 0}


class TestRefreshAnalyticsEndpoint:
    @pytest.mark.asyncio
    async def test_503_when_secret_unset(self, client, monkeypatch):
        monkeypatch.setattr(settings_module.settings, "internal_jobs_secret", "", raising=False)
        assert (await client.post(ANALYTICS_PATH)).status_code == 503

    @pytest.mark.asyncio
    async def test_403_on_wrong_key(self, client, monkeypatch):
        monkeypatch.setattr(settings_module.settings, "internal_jobs_secret", "s3cret", raising=False)
        response = await client.post(ANALYTICS_PATH, headers={"X-Internal-Key": "nope"})
        assert response.status_code == 403

    @pytest.mark.asyncio
    @patch("app.features.jobs.service.get_supabase_client")
    async def test_200_calls_the_rpc_with_the_service_role_client(self, mock_client, client, monkeypatch):
        monkeypatch.setattr(settings_module.settings, "internal_jobs_secret", "s3cret", raising=False)

        response = await client.post(ANALYTICS_PATH, headers={"X-Internal-Key": "s3cret"})

        assert response.status_code == 200
        assert response.json() == {"refreshed": True}
        # Migration 46 revoked EXECUTE from `authenticated`; only service-role works.
        mock_client.assert_called_once_with()
        mock_client.return_value.rpc.assert_called_once_with("refresh_analytics", {})


class TestStuckRecovery:
    def test_sending_rows_older_than_the_threshold_go_back_to_pending(self):
        from datetime import UTC, datetime

        table = MagicMock()
        for method in ("update", "eq", "lt", "is_"):
            getattr(table, method).return_value = table
        table.execute.return_value = MagicMock(data=[{"id": "r1"}, {"id": "r2"}])
        client = MagicMock()
        client.table.return_value = table

        recovered = jobs_service._recover_stuck(client, datetime(2026, 8, 16, 12, 0, tzinfo=UTC))

        assert recovered == 2
        table.update.assert_called_once_with({"status": "PENDING"})
        table.eq.assert_called_once_with("status", "SENDING")
        table.lt.assert_called_once_with("updated_at", "2026-08-16T11:50:00+00:00")


class TestBoundedClaim:
    def test_claim_is_capped_and_filtered_on_pending(self):
        table = MagicMock()
        for method in ("select", "update", "eq", "lte", "is_", "in_", "order", "limit"):
            getattr(table, method).return_value = table
        table.execute.side_effect = [
            MagicMock(data=[{"id": "r1"}, {"id": "r2"}]),
            MagicMock(data=[{"id": "r1"}, {"id": "r2"}]),
        ]
        client = MagicMock()
        client.table.return_value = table

        claimed = jobs_service._claim_due(client, "2026-08-16T12:00:00+00:00")

        assert [r["id"] for r in claimed] == ["r1", "r2"]
        table.limit.assert_called_once_with(jobs_service.CLAIM_BATCH)
        table.in_.assert_called_once_with("id", ["r1", "r2"])
        table.eq.assert_any_call("status", "PENDING")

    def test_no_due_rows_skips_the_claim_update(self):
        table = MagicMock()
        for method in ("select", "update", "eq", "lte", "is_", "order", "limit"):
            getattr(table, method).return_value = table
        table.execute.return_value = MagicMock(data=[])
        client = MagicMock()
        client.table.return_value = table

        assert jobs_service._claim_due(client, "2026-08-16T12:00:00+00:00") == []
        table.update.assert_not_called()


REMINDER = {"id": "r1", "tenant_id": "t1", "user_id": "u1", "message": "hola", "url": "/"}


class TestSendRetries:
    @pytest.mark.asyncio
    async def test_transient_failure_is_retried_then_succeeds(self, monkeypatch):
        monkeypatch.setattr(jobs_service, "RETRY_BACKOFF_SECONDS", 0)
        calls = {"n": 0}

        async def flaky(**_kwargs):
            calls["n"] += 1
            if calls["n"] < 2:
                raise OSError("network blip")

        monkeypatch.setattr(jobs_service, "send_push", flaky)

        assert await jobs_service._send_with_retries(REMINDER) is None
        assert calls["n"] == 2

    @pytest.mark.asyncio
    async def test_gives_up_after_the_attempt_cap(self, monkeypatch):
        monkeypatch.setattr(jobs_service, "RETRY_BACKOFF_SECONDS", 0)
        calls = {"n": 0}

        async def always_fails(**_kwargs):
            calls["n"] += 1
            raise OSError("vapid down")

        monkeypatch.setattr(jobs_service, "send_push", always_fails)

        error = await jobs_service._send_with_retries(REMINDER)

        assert isinstance(error, OSError)
        assert calls["n"] == jobs_service.SEND_ATTEMPTS

    @pytest.mark.asyncio
    @patch("app.features.jobs.service.get_supabase_client")
    async def test_a_reminder_only_fails_after_every_attempt(self, mock_client, monkeypatch):
        monkeypatch.setattr(jobs_service, "RETRY_BACKOFF_SECONDS", 0)
        table = _reminders_table(due=[{"id": "r1"}], claimed=[REMINDER])
        mock_client.return_value.table.return_value = table

        async def always_fails(**_kwargs):
            raise OSError("vapid down")

        monkeypatch.setattr(jobs_service, "send_push", always_fails)

        out = await jobs_service.run_due_reminders()

        assert out == {"sent": 0, "failed": 1, "recovered": 0, "claimed": 1}
        final = table.update.call_args[0][0]
        assert final["status"] == "FAILED"
        assert "3 intentos" in final["error"]
