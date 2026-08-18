"""Tenant snapshot cache (context.load_snapshot).

The snapshot is 9 sequential PostgREST round-trips on the hot path of every
turn, so it must not be refetched per turn.
"""

from __future__ import annotations

from uuid import uuid4

import pytest

from app.features.agent import context

TENANT = uuid4()


@pytest.fixture(autouse=True)
def _clear_cache():
    context.invalidate_snapshot()
    yield
    context.invalidate_snapshot()


@pytest.fixture
def counting_fetch(monkeypatch: pytest.MonkeyPatch) -> list[int]:
    calls = [0]

    def fake_fetch(tenant_id):
        calls[0] += 1
        return context.TenantSnapshot(tenant_id=tenant_id, tenant_name=f"call-{calls[0]}")

    monkeypatch.setattr(context, "_fetch_snapshot", fake_fetch)
    return calls


def test_second_call_within_ttl_hits_cache(counting_fetch):
    first = context.load_snapshot(TENANT)
    second = context.load_snapshot(TENANT)
    assert counting_fetch[0] == 1
    assert second is first


def test_force_refresh_bypasses_cache(counting_fetch):
    context.load_snapshot(TENANT)
    refreshed = context.load_snapshot(TENANT, force_refresh=True)
    assert counting_fetch[0] == 2
    assert refreshed.tenant_name == "call-2"


def test_invalidate_forces_a_refetch(counting_fetch):
    context.load_snapshot(TENANT)
    context.invalidate_snapshot(TENANT)
    context.load_snapshot(TENANT)
    assert counting_fetch[0] == 2


def test_expired_entry_is_refetched(counting_fetch, monkeypatch: pytest.MonkeyPatch):
    now = [0.0]
    monkeypatch.setattr(context.time, "monotonic", lambda: now[0])
    context.load_snapshot(TENANT)
    now[0] = context._SNAPSHOT_TTL_SECONDS + 1
    context.load_snapshot(TENANT)
    assert counting_fetch[0] == 2


def test_cache_is_keyed_per_tenant(counting_fetch):
    other = uuid4()
    context.load_snapshot(TENANT)
    context.load_snapshot(other)
    context.load_snapshot(TENANT)
    assert counting_fetch[0] == 2
