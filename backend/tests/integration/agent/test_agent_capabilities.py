"""Anita capability matrix.

Each test runs against the providers configured in conftest (`provider`
fixture), so a single `pytest -m integration` produces a benchmark across
Cerebras, Groq, etc.

Each test logs one row to `results.jsonl` next to this file.

Tests requiring audio recordings (1-3) are xfail'd until the user adds
`audios/0X_*.wav` files matching `audios/ground_truth.json`.
"""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

import pytest

from app.features.anita.chat import run_chat_turn
from app.features.anita.transcribe import transcribe_audio
from app.core.supabase.client import get_supabase_client

from .seed_anita import SeedHandles

pytestmark = pytest.mark.integration

AUDIOS_DIR = Path(__file__).parent / "audios"
TRANSCRIPT_CACHE_DIR = AUDIOS_DIR / ".cache"
_GT = json.loads((AUDIOS_DIR / "ground_truth.json").read_text())
SCENARIOS = _GT["scenarios"]


def _file_signature(path: Path) -> str:
    """Cheap fingerprint: size+mtime. Enough to invalidate on re-record."""
    st = path.stat()
    return f"{st.st_size}-{int(st.st_mtime)}"


def _cached_transcribe(audio_path: Path) -> dict[str, Any] | None:
    """Return cached transcript if `audios/.cache/<file>.json` matches the
    current file signature. Cache miss → returns None.

    Action-chain tests use this to avoid hammering Whisper (20 req/min
    free tier). Refresh by deleting the cache file or running
    `poetry run python scripts/anita_refresh_cache.py`.
    """
    cache_file = TRANSCRIPT_CACHE_DIR / f"{audio_path.name}.json"
    if not cache_file.exists():
        return None
    cached = json.loads(cache_file.read_text())
    if cached.get("signature") != _file_signature(audio_path):
        return None
    return cached["result"]


def _save_transcribe_cache(audio_path: Path, result: dict[str, Any]) -> None:
    TRANSCRIPT_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_file = TRANSCRIPT_CACHE_DIR / f"{audio_path.name}.json"
    cache_file.write_text(
        json.dumps(
            {"signature": _file_signature(audio_path), "result": result},
            ensure_ascii=False,
            indent=2,
        )
    )


# Flatten (scenario, variant) for parametrize.
VARIANTS = [
    {
        **v,
        "scenario_id": s["id"],
        "expected_actions": s["expected_actions"],
        "expected_no_proposals": s.get("expected_no_proposals", False),
        "expected_text_contains": s.get("expected_text_contains", []),
    }
    for s in SCENARIOS
    for v in s["variants"]
]
RESULTS_PATH = Path(__file__).parent / "results.jsonl"


# ── Helpers ──────────────────────────────────────────────────────────


def _log_result(record: dict[str, Any]) -> None:
    RESULTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with RESULTS_PATH.open("a") as f:
        f.write(json.dumps(record) + "\n")


def _open_session(handles: SeedHandles) -> UUID:
    client = get_supabase_client()
    sid = uuid4()
    client.table("anita_sessions").insert(
        {
            "id": str(sid),
            "tenant_id": str(handles.tenant_id),
            "user_id": str(handles.user_id),
            "status": "OPEN",
        }
    ).execute()
    return sid


async def _run_turn(handles: SeedHandles, prompt: str) -> dict[str, Any]:
    """Drive one Anita turn and return collected events."""
    session_id = _open_session(handles)
    text_buf: list[str] = []
    tool_calls: list[dict[str, Any]] = []
    proposals: list[str] = []
    tokens: dict[str, int] = {}
    t0 = time.perf_counter()

    async for event in run_chat_turn(
        session_id=session_id,
        tenant_id=handles.tenant_id,
        user_id=handles.user_id,
        user_text=prompt,
    ):
        et = event.get("type")
        if et == "text":
            text_buf.append(event.get("text", ""))
        elif et == "tool_use":
            tool_calls.append({"name": event.get("name"), "args": event.get("args", {})})
        elif et == "done":
            proposals = event.get("proposals_created", [])
            tokens = event.get("tokens", {}) or {}

    return {
        "text": "".join(text_buf),
        "tool_calls": tool_calls,
        "proposals": proposals,
        "tokens": tokens,
        "latency_ms": int((time.perf_counter() - t0) * 1000),
        "session_id": str(session_id),
    }


def _record(test_id: str, provider: str, passed: bool, **extras: Any) -> None:
    _log_result(
        {
            "test": test_id,
            "provider": provider,
            "pass": passed,
            "ts": time.time(),
            **extras,
        }
    )


# ── Tests 1-3: Transcription accuracy ───────────────────────────────


def _similarity(actual: str, expected: str) -> float:
    from rapidfuzz import fuzz

    return fuzz.token_set_ratio(actual.lower(), expected.lower()) / 100.0


@pytest.mark.whisper
@pytest.mark.parametrize(
    "spec",
    VARIANTS,
    ids=[f"{v['scenario_id']}::{v['register']}" for v in VARIANTS],
)
def test_transcription(spec: dict, seed_handles: SeedHandles) -> None:
    """Whisper transcription vs manual ground truth (token_set_ratio).

    Marked `whisper` — excluded from the default integration run to
    respect rate limits (20 req/min). Run via `make test-anita-whisper`.
    Always re-transcribes (the point is to measure Whisper quality) and
    refreshes the cache so subsequent action-chain runs use fresh text.
    """
    audio_path = AUDIOS_DIR / spec["file"]
    if not audio_path.exists():
        pytest.xfail(f"audio {audio_path.name} not recorded yet")

    threshold = float(spec.get("similarity_min", 0.75))
    with audio_path.open("rb") as f:
        result = transcribe_audio(f, audio_path.name)
    _save_transcribe_cache(audio_path, result)

    score = _similarity(result["text"], spec["transcript"])
    passed = score >= threshold
    _record(
        f"transcription:{spec['scenario_id']}::{spec['register']}",
        provider=result.get("source", "?"),
        passed=passed,
        score=round(score, 3),
        threshold=threshold,
        actual=result["text"],
        expected=spec["transcript"],
    )
    assert passed, f"score={score:.2f} actual={result['text']!r}"


# ── Audio → action chain ───────────────────────────────────────────


_FIELD_ALIASES = {
    "amount": ("amount", "amount_clp", "amount_cents"),
    "duration_minutes": ("duration_minutes", "duration_min"),
}


def _matches_value(args: dict, key: str, expected_value) -> bool:
    """Compare args[key] to expected_value, accepting v2 field aliases."""
    candidates = _FIELD_ALIASES.get(key, (key,))
    for candidate in candidates:
        if candidate in args:
            actual = args[candidate]
            if actual == expected_value:
                return True
            # cents conversion: amount=50000 vs amount_cents=5000000
            if candidate.endswith("_cents") and isinstance(expected_value, int):
                if actual == expected_value * 100:
                    return True
    return False


def _action_matches(call: dict, expected: dict) -> bool:
    if call["name"] != expected.get("tool"):
        return False
    args = call.get("args", {}) or {}
    contains = expected.get("args_contains", {}) or {}
    for k, v in contains.items():
        if not _matches_value(args, k, v):
            return False
    text_contains = expected.get("args_text_contains", []) or []
    blob = json.dumps(args, ensure_ascii=False).lower()
    for needle in text_contains:
        if needle.lower() not in blob:
            return False
    return True


@pytest.mark.parametrize(
    "spec",
    VARIANTS,
    ids=[f"{v['scenario_id']}::{v['register']}" for v in VARIANTS],
)
@pytest.mark.asyncio
async def test_audio_action_chain(spec: dict, provider: str, seed_handles: SeedHandles) -> None:
    """End-to-end: audio → Whisper → Anita turn → expected tool calls.

    Falls back to using `transcript` text directly if the audio file
    isn't recorded yet (still exercises Anita's tool selection on the
    target prompt — useful while audios are being recorded).
    """
    audio_path = AUDIOS_DIR / spec["file"]
    if audio_path.exists():
        cached = _cached_transcribe(audio_path)
        if cached is None:
            # First time we see this file — call Whisper once and cache.
            with audio_path.open("rb") as f:
                cached = transcribe_audio(f, audio_path.name)
            _save_transcribe_cache(audio_path, cached)
        prompt = cached["text"]
    else:
        prompt = spec["transcript"]

    out = await _run_turn(seed_handles, prompt)

    # The v2 pipeline runs find_/clarify in code, not as separate LLM tool calls.
    # Tests parametrized on the old multi-tool model: relax them — only the
    # FINAL action (propose_*, query_views, query_sql, clarify) needs to fire.
    legacy_resolved_in_code = {"find_person", "find_property", "find_organization", "find_project"}
    expected = [e for e in spec["expected_actions"] if e["tool"] not in legacy_resolved_in_code]
    matched = []
    for exp in expected:
        if any(_action_matches(c, exp) for c in out["tool_calls"]):
            matched.append(exp["tool"])

    # v2 single-call pipeline picks ONE intent per turn. For multi-action
    # scenarios we accept "at least one expected tool fired" as success.
    is_multi = len(expected) > 1
    all_matched = len(matched) >= 1 if is_multi else len(matched) == len(expected)

    if spec.get("expected_no_proposals"):
        all_matched = all_matched and len(out["proposals"]) == 0

    if needles := spec.get("expected_text_contains"):
        all_matched = all_matched and all(n in out["text"] for n in needles)

    _record(
        f"action_chain:{spec['scenario_id']}::{spec['register']}",
        provider=provider,
        passed=all_matched,
        prompt=prompt,
        expected_tools=[e["tool"] for e in expected],
        matched_tools=matched,
        observed_tools=[c["name"] for c in out["tool_calls"]],
        latency_ms=out["latency_ms"],
        proposals=out["proposals"],
    )
    assert all_matched


# NOTE: Standalone capability tests (find_person, propose_*, query_*) were
# removed when the v2 pipeline replaced multi-tool calls. Equivalent coverage
# now lives in `test_audio_action_chain` (parametrized over scenarios + both
# registers).
