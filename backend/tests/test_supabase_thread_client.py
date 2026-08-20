"""The read fan-out must not share one connection across threads.

`/v1/attention` and the person overview run their PostgREST reads through
`asyncio.to_thread`. The shared Supabase client wraps a single synchronous
httpx session over one HTTP/2 connection whose state machine is not guarded,
so using it from several threads at once corrupted the stream and the server
hung up: `httpcore.RemoteProtocolError: Server disconnected` — a 500 in
production on the first request, with every local run green.
"""

from __future__ import annotations

import threading

from app.core.supabase import client as client_module


def test_each_thread_gets_its_own_client(monkeypatch) -> None:
    built: list[object] = []

    def fake_build_client(*args, **kwargs):
        made = object()
        built.append(made)
        return made

    monkeypatch.setattr(client_module, "build_client", fake_build_client)
    monkeypatch.setattr(client_module, "_thread_local", threading.local())

    seen: dict[str, object] = {}

    def grab(name: str) -> None:
        # Twice, so a per-thread cache hit is visible as one construction.
        seen[name] = client_module.get_thread_client()
        assert client_module.get_thread_client() is seen[name]

    threads = [threading.Thread(target=grab, args=(f"t{i}",)) for i in range(3)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert len(seen) == 3
    assert len({id(c) for c in seen.values()}) == 3, "threads shared a client"
    assert len(built) == 3, "a client was built more than once per thread"


def test_thread_client_ignores_the_context_scoped_one(monkeypatch) -> None:
    """Scoped clients carry per-request audit headers and are single-use.

    Handing one to a fan-out would put every thread back on one connection,
    which is the bug this whole mechanism exists to avoid.
    """
    monkeypatch.setattr(client_module, "build_client", lambda *a, **k: "thread-owned")
    monkeypatch.setattr(client_module, "_thread_local", threading.local())

    token = client_module._scoped_client.set("scoped")  # type: ignore[arg-type]
    try:
        assert client_module.get_supabase_client() == "scoped"
        assert client_module.get_thread_client() == "thread-owned"
    finally:
        client_module._scoped_client.reset(token)
