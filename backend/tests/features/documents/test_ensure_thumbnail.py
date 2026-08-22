"""On-demand thumbnail rendering, and the guards that stop it thrashing.

The failure mode this protects against is not an error, it is cost: a grid of
tiles that each ask for a render, of a file that can never produce one, on every
mount. So the assertions are mostly "storage was not touched".
"""

from __future__ import annotations

from typing import Any

import pytest

from app.features.documents import service as svc


class _Result:
    def __init__(self, data: Any) -> None:
        self.data = data


class _Query:
    """Chainable stand-in for the PostgREST builder. Filters are recorded, not applied."""

    def __init__(self, table: _Table, rows: list[dict]) -> None:
        self._table = table
        self._rows = rows
        self._update: dict | None = None

    def select(self, *_: Any, **__: Any) -> _Query:
        return self

    def eq(self, *_: Any) -> _Query:
        return self

    def is_(self, *_: Any) -> _Query:
        return self

    def limit(self, *_: Any) -> _Query:
        return self

    def update(self, payload: dict) -> _Query:
        self._update = payload
        return self

    def execute(self) -> _Result:
        if self._update is not None:
            self._table.updates.append(self._update)
            for row in self._table.rows:
                row.update(self._update)
            return _Result(self._table.rows)
        return _Result(self._rows)


class _Table:
    def __init__(self, rows: list[dict]) -> None:
        self.rows = rows
        self.updates: list[dict] = []


class _Client:
    def __init__(self, docs: list[dict], versions: list[dict]) -> None:
        self.tables = {svc.DOCUMENTS_TABLE: _Table(docs), svc.VERSIONS_TABLE: _Table(versions)}

    def table(self, name: str) -> _Query:
        t = self.tables[name]
        return _Query(t, t.rows)


DOC_ID = "11111111-1111-4111-8111-111111111111"
TENANT = "22222222-2222-4222-8222-222222222222"
VER_ID = "33333333-3333-4333-8333-333333333333"


def _wire(monkeypatch: pytest.MonkeyPatch, version: dict) -> dict[str, int]:
    """Install a fake client + storage, and count the expensive calls."""
    calls = {"download": 0, "render": 0, "signed": 0}
    client = _Client(
        [{"id": DOC_ID, "tenant_id": TENANT, "current_version_id": VER_ID}],
        [version],
    )
    monkeypatch.setattr(svc, "get_supabase_client", lambda: client)

    def _download(_path: str) -> bytes:
        calls["download"] += 1
        return b"bytes"

    def _signed(path: str, _ttl: int | None = None) -> str:
        calls["signed"] += 1
        return f"https://signed/{path}"

    def _render(**kwargs: Any) -> tuple[str | None, str]:
        calls["render"] += 1
        return "t/4_thumbnails/d/v1.webp", svc.THUMB_READY

    monkeypatch.setattr(svc.storage, "download_object", _download)
    monkeypatch.setattr(svc.storage, "signed_url", _signed)
    monkeypatch.setattr(svc, "_maybe_generate_thumbnail", _render)
    return calls


def _version(**over: Any) -> dict:
    row = {
        "id": VER_ID,
        "version_number": 1,
        "mime_type": "application/pdf",
        "raw_path": "t/1_raw/d/abc.pdf",
        "thumbnail_path": None,
        "thumbnail_state": svc.THUMB_PENDING,
        "thumbnail_attempts": 0,
    }
    row.update(over)
    return row


def test_ready_version_signs_without_rendering(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = _wire(monkeypatch, _version(thumbnail_path="t/x.webp", thumbnail_state=svc.THUMB_READY))
    url, state = svc._render_current_thumbnail(DOC_ID, TENANT)
    assert state == svc.THUMB_READY
    assert url == "https://signed/t/x.webp"
    assert calls["render"] == 0 and calls["download"] == 0


def test_unsupported_version_does_not_touch_storage(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = _wire(monkeypatch, _version(thumbnail_state=svc.THUMB_UNSUPPORTED))
    url, state = svc._render_current_thumbnail(DOC_ID, TENANT)
    assert (url, state) == (None, svc.THUMB_UNSUPPORTED)
    assert calls == {"download": 0, "render": 0, "signed": 0}


def test_failed_version_does_not_retry(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = _wire(monkeypatch, _version(thumbnail_state=svc.THUMB_FAILED))
    assert svc._render_current_thumbnail(DOC_ID, TENANT) == (None, svc.THUMB_FAILED)
    assert calls["render"] == 0


def test_exhausted_attempts_are_terminal(monkeypatch: pytest.MonkeyPatch) -> None:
    """Still PENDING, but out of budget: this is the corrupt-PDF case."""
    calls = _wire(monkeypatch, _version(thumbnail_attempts=svc.MAX_THUMB_ATTEMPTS))
    assert svc._render_current_thumbnail(DOC_ID, TENANT) == (None, svc.THUMB_FAILED)
    assert calls["render"] == 0


def test_pending_version_renders_and_returns_a_url(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = _wire(monkeypatch, _version())
    url, state = svc._render_current_thumbnail(DOC_ID, TENANT)
    assert state == svc.THUMB_READY
    assert url.startswith("https://signed/")
    assert calls["render"] == 1 and calls["download"] == 1


def test_second_call_after_a_render_does_not_render_again(monkeypatch: pytest.MonkeyPatch) -> None:
    """The fake client persists the update, so this is the real re-read path."""
    calls = _wire(monkeypatch, _version())
    svc._render_current_thumbnail(DOC_ID, TENANT)
    svc._render_current_thumbnail(DOC_ID, TENANT)
    assert calls["render"] == 1


def test_version_without_raw_path_is_marked_unsupported(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = _wire(monkeypatch, _version(raw_path=None))
    assert svc._render_current_thumbnail(DOC_ID, TENANT) == (None, svc.THUMB_UNSUPPORTED)
    assert calls["download"] == 0


def test_document_without_a_current_version(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _Client([{"id": DOC_ID, "tenant_id": TENANT, "current_version_id": None}], [])
    monkeypatch.setattr(svc, "get_supabase_client", lambda: client)
    assert svc._render_current_thumbnail(DOC_ID, TENANT) == (None, svc.THUMB_UNSUPPORTED)
