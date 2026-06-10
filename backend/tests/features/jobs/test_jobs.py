"""Internal job endpoint auth (shared-secret header gate)."""

import pytest

from app.core.config import settings as settings_module

JOBS_PATH = "/api/v1/internal/jobs/run-due-reminders"


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
async def test_jobs_200_on_correct_key(client, monkeypatch):
    monkeypatch.setattr(settings_module.settings, "internal_jobs_secret", "s3cret", raising=False)
    response = await client.post(JOBS_PATH, headers={"X-Internal-Key": "s3cret"})
    assert response.status_code == 200
    assert response.json() == {"sent": 0, "failed": 0}
