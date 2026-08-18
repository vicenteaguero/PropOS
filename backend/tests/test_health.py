from unittest.mock import MagicMock, patch

import pytest


@pytest.mark.asyncio
async def test_health_check(client):
    response = await client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


@pytest.mark.asyncio
async def test_readiness_ok_when_database_reachable(client):
    with (
        patch("app.main._probe_database", return_value=(True, None)),
        patch("app.main._probe_jobs", return_value={"status": "ok", "reminders_overdue": 0}),
    ):
        response = await client.get("/health/ready")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ready"
    assert body["checks"] == {"database": "ok", "secrets": "ok"}


@pytest.mark.asyncio
async def test_readiness_503_when_database_unreachable(client):
    """The whole point of the endpoint: /health stays 200 while this goes red."""
    with patch("app.main._probe_database", return_value=(False, "ConnectionError")):
        response = await client.get("/health/ready")

    assert response.status_code == 503
    body = response.json()
    assert body["status"] == "not_ready"
    assert body["checks"]["database"] == "error"


@pytest.mark.asyncio
async def test_readiness_503_when_core_secret_missing(client):
    with (
        patch("app.main._probe_database", return_value=(True, None)),
        patch("app.main._probe_jobs", return_value={"status": "ok"}),
        patch("app.main.settings.supabase_service_role_key", ""),
    ):
        response = await client.get("/health/ready")

    assert response.status_code == 503
    assert response.json()["checks"]["secrets"] == "missing"


@pytest.mark.asyncio
async def test_readiness_detail_lists_dark_integrations(client):
    """Optional integrations are reported, never fatal — they are off on purpose."""
    with (
        patch("app.main._probe_database", return_value=(True, None)),
        patch("app.main._probe_jobs", return_value={"status": "ok"}),
        patch("app.main.settings.kapso_api_key", ""),
    ):
        response = await client.get("/health/ready")

    assert response.status_code == 200
    assert response.json()["detail"]["integrations"]["whatsapp_kapso"] == "off"


@pytest.mark.asyncio
async def test_readiness_hides_detail_in_production_without_internal_key(client):
    with (
        patch("app.main._probe_database", return_value=(True, None)),
        patch("app.main._probe_jobs", return_value={"status": "ok"}),
        patch("app.main.settings.app_env", "production"),
        patch("app.main.settings.internal_jobs_secret", "s3cret"),
    ):
        anonymous = await client.get("/health/ready")
        authorised = await client.get("/health/ready", headers={"X-Internal-Key": "s3cret"})

    assert "detail" not in anonymous.json()
    assert "integrations" in authorised.json()["detail"]


@pytest.mark.asyncio
async def test_probe_database_reports_the_failure_type():
    """Any exception means "not ready" — the class name is enough to triage."""
    from app.main import _probe_database

    with patch("app.core.supabase.client.get_supabase_client", side_effect=ConnectionError("dns")):
        ok, error = await _probe_database()

    assert ok is False
    assert error == "ConnectionError"


@pytest.mark.asyncio
async def test_probe_database_ok_on_a_successful_read():
    from app.main import _probe_database

    client = MagicMock()
    with patch("app.core.supabase.client.get_supabase_client", return_value=client):
        ok, error = await _probe_database()

    assert (ok, error) == (True, None)
    client.table.assert_called_once_with("tenants")


@pytest.mark.asyncio
async def test_probe_jobs_flags_a_reminder_backlog():
    """Overdue PENDING reminders mean nothing is draining the queue."""
    from app.main import _probe_jobs

    client = MagicMock()
    client.table.return_value.select.return_value.eq.return_value.lt.return_value.is_.return_value.limit.return_value.execute.return_value.count = 4

    with patch("app.core.supabase.client.get_supabase_client", return_value=client):
        result = await _probe_jobs()

    assert result == {"reminders_overdue": 4, "status": "stale"}


@pytest.mark.asyncio
async def test_probe_jobs_never_raises():
    """Advisory signal: a broken query degrades to 'unknown', never to a 503."""
    from app.main import _probe_jobs

    with patch("app.core.supabase.client.get_supabase_client", side_effect=RuntimeError("boom")):
        assert await _probe_jobs() == {"status": "unknown"}
