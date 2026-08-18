from unittest.mock import patch

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
