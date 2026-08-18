"""Retention sweep — Ley 21.719 Art. 14 quinquies.

Every deletion here is permanent, so the tests pin down the cutoffs that are
sent to the database and the order the two-step media purge runs in.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from app.core.config.settings import settings
from app.features.compliance import service as compliance_service
from app.features.compliance.service import run_retention_sweep, storage_path_from_url
from tests.features.compliance.fakes import FakeSupabaseClient

NOW = datetime(2026, 8, 16, 12, 0, tzinfo=UTC)


@pytest.fixture
def fake_client(monkeypatch):
    client = FakeSupabaseClient(
        rpc_results={
            "compliance_expired_media": [
                {
                    "id": "11111111-1111-1111-1111-111111111111",
                    "tenant_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
                    "url": "https://x.supabase.co/storage/v1/object/public/media/tenant/audio-1.webm",
                },
                {
                    "id": "22222222-2222-2222-2222-222222222222",
                    "tenant_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
                    "url": "https://x.supabase.co/storage/v1/object/public/media/tenant/audio-2.webm",
                },
            ],
            "compliance_purge_media_files": 2,
            "compliance_purge_webhook_events": 7,
            "compliance_purge_agent_transcripts": 3,
            "compliance_purge_audit_log": 1,
        }
    )
    monkeypatch.setattr(compliance_service, "get_supabase_client", lambda: client)
    return client


async def test_sweep_reports_what_it_deleted(fake_client):
    counts = await run_retention_sweep(now=NOW)

    assert counts == {
        "media_files": 2,
        "media_blobs": 2,
        "webhook_events": 7,
        "transcripts": 3,
        "audit_log": 1,
    }


async def test_blobs_are_removed_before_the_rows_that_point_at_them(fake_client):
    """The row is the only pointer to the object; dropping it first orphans the blob."""
    await run_retention_sweep(now=NOW)

    assert fake_client.removed_blobs == [
        ("media", "tenant/audio-1.webm"),
        ("media", "tenant/audio-2.webm"),
    ]
    purge_index = [i for i, (name, _) in enumerate(fake_client.rpc_calls) if name == "compliance_purge_media_files"][0]
    expired_index = [i for i, (name, _) in enumerate(fake_client.rpc_calls) if name == "compliance_expired_media"][0]
    assert expired_index < purge_index


async def test_a_blob_that_cannot_be_removed_keeps_its_row(monkeypatch):
    """Better an undeleted row the next sweep retries than a blob nobody can find."""
    client = FakeSupabaseClient(
        rpc_results={
            "compliance_expired_media": [
                {
                    "id": "11111111-1111-1111-1111-111111111111",
                    "tenant_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
                    "url": "https://x.supabase.co/storage/v1/object/public/media/tenant/audio-1.webm",
                }
            ],
            "compliance_purge_media_files": 0,
        },
        failing_buckets={"media"},
    )
    monkeypatch.setattr(compliance_service, "get_supabase_client", lambda: client)

    counts = await run_retention_sweep(now=NOW)

    assert counts["media_blobs"] == 0
    assert counts["media_files"] == 0
    assert not any(name == "compliance_purge_media_files" for name, _ in client.rpc_calls)


async def test_cutoffs_come_from_the_configured_windows(fake_client):
    await run_retention_sweep(now=NOW)

    transcripts_cutoff = fake_client.rpc_params("compliance_purge_agent_transcripts")["p_before"]
    audit_cutoff = fake_client.rpc_params("compliance_purge_audit_log")["p_before"]

    assert transcripts_cutoff == (NOW - timedelta(days=settings.retention_agent_transcripts_days)).isoformat()
    assert audit_cutoff == (NOW - timedelta(days=settings.retention_audit_log_days)).isoformat()


async def test_webhook_events_are_purged_by_their_own_per_row_expiry(fake_client):
    """`purge_after` is stamped at insert, so the sweep only needs `now`."""
    await run_retention_sweep(now=NOW)

    assert fake_client.rpc_params("compliance_purge_webhook_events") == {"p_before": NOW.isoformat()}


async def test_default_windows_match_the_rat():
    """docs/compliance/rat.yaml is the declared policy; the code has to agree."""
    assert settings.retention_webhook_events_days == 60  # whatsapp_kapso
    assert settings.retention_agent_transcripts_days == 90  # ia_anita
    assert settings.retention_audit_log_days == 1825  # auditoria — 5 years


async def test_sweep_with_nothing_expired_is_a_no_op(monkeypatch):
    client = FakeSupabaseClient(rpc_results={"compliance_expired_media": []})
    monkeypatch.setattr(compliance_service, "get_supabase_client", lambda: client)

    counts = await run_retention_sweep(now=NOW)

    assert counts["media_files"] == 0
    assert client.removed_blobs == []
    assert not any(name == "compliance_purge_media_files" for name, _ in client.rpc_calls)


@pytest.mark.parametrize(
    ("url", "expected"),
    [
        ("https://x.supabase.co/storage/v1/object/public/media/t/a.webm", ("media", "t/a.webm")),
        ("https://x.supabase.co/storage/v1/object/sign/documents/t/d.pdf", ("documents", "t/d.pdf")),
        ("https://x.supabase.co/storage/v1/object/authenticated/media/t/a.webm", ("media", "t/a.webm")),
        ("https://x.supabase.co/storage/v1/object/media/t/a.webm", ("media", "t/a.webm")),
        (
            "https://x.supabase.co/storage/v1/object/public/media/t/nota%20de%20voz.webm",
            ("media", "t/nota de voz.webm"),
        ),
        # Not ours to delete.
        ("https://cdn.example.com/photo.jpg", None),
        ("", None),
        (None, None),
    ],
)
def test_storage_path_parsing(url, expected):
    assert storage_path_from_url(url) == expected
