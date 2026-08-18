"""Voice notes must survive the request that transcribed them."""

from __future__ import annotations

from typing import Any
from uuid import UUID, uuid4

import pytest

from app.features.agent import audio_store
from app.features.agent.audio_store import BUCKET, _extension, store_voice_note

TENANT = uuid4()
USER = str(uuid4())
MEDIA_ID = str(uuid4())


class _Bucket:
    def __init__(self, uploads: list[dict[str, Any]], fail: bool = False) -> None:
        self._uploads = uploads
        self._fail = fail

    def upload(self, *, path: str, file: bytes, file_options: dict[str, str]) -> None:
        if self._fail:
            raise RuntimeError("bucket unavailable")
        self._uploads.append({"path": path, "bytes": file, "options": file_options})

    def get_public_url(self, path: str) -> str:
        return f"https://storage.test/{BUCKET}/{path}"


class _Table:
    def __init__(self, inserts: list[dict[str, Any]]) -> None:
        self._inserts = inserts

    def insert(self, row: dict[str, Any]) -> _Table:
        self._inserts.append(row)
        return self

    def execute(self) -> Any:
        return type("R", (), {"data": [{"id": MEDIA_ID}]})()


class _Storage:
    def __init__(self, bucket: _Bucket) -> None:
        self._bucket = bucket
        self.buckets: list[str] = []

    def from_(self, name: str) -> _Bucket:
        self.buckets.append(name)
        return self._bucket


class _Client:
    def __init__(self, fail_upload: bool = False) -> None:
        self.uploads: list[dict[str, Any]] = []
        self.inserts: list[dict[str, Any]] = []
        self.storage = _Storage(_Bucket(self.uploads, fail=fail_upload))

    def table(self, _name: str) -> _Table:
        return _Table(self.inserts)


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> _Client:
    fake = _Client()
    monkeypatch.setattr(audio_store, "get_supabase_client", lambda: fake)
    return fake


def test_extension_prefers_the_mime_type():
    assert _extension("blob", "audio/webm;codecs=opus") == "webm"
    assert _extension("nota.m4a", None) == "m4a"
    assert _extension(None, None) == "webm"


def test_upload_and_row_use_the_constrained_vocabulary(client):
    media_id = store_voice_note(b"\x1a\x45", tenant_id=TENANT, user_id=USER, filename="v.webm", mime="audio/webm")

    assert media_id == UUID(MEDIA_ID)
    assert client.storage.buckets == [BUCKET, BUCKET]

    upload = client.uploads[0]
    assert upload["path"].startswith(f"{TENANT}/agent-audio/")
    assert upload["path"].endswith(".webm")
    assert upload["options"]["content-type"] == "audio/webm"

    row = client.inserts[0]
    # media_files CHECK-constrains both columns; anything else is a 400 at insert.
    assert row["type"] == "audio"
    assert row["source"] == "recorder"
    assert row["kind"] == "AUDIO"
    assert row["tenant_id"] == str(TENANT)
    assert row["uploaded_by"] == USER
    assert row["url"].endswith(upload["path"])


def test_empty_payload_is_skipped(client):
    assert store_voice_note(b"", tenant_id=TENANT, user_id=USER) is None
    assert client.uploads == []


def test_storage_failure_never_breaks_the_transcript(monkeypatch: pytest.MonkeyPatch):
    broken = _Client(fail_upload=True)
    monkeypatch.setattr(audio_store, "get_supabase_client", lambda: broken)
    assert store_voice_note(b"abc", tenant_id=TENANT, user_id=USER) is None
    assert broken.inserts == []
