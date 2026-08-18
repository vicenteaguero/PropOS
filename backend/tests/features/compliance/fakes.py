"""Minimal stand-in for the supabase-py client.

Only the fluent surface the compliance service actually uses. Every call is
recorded so a test can assert on *what was sent* — which, for erasure and
purge, is the whole point: those writes are irreversible, so the assertion has
to be on the payload, not on a return value.
"""

from __future__ import annotations

from typing import Any


class _Result:
    def __init__(self, data: Any) -> None:
        self.data = data


class _Query:
    def __init__(self, client: FakeSupabaseClient, table: str) -> None:
        self._client = client
        self._table = table
        self._op = "select"
        self._payload: Any = None
        self._filters: list[tuple[str, Any]] = []

    # --- verbs ---
    def select(self, *_args: Any, **_kwargs: Any) -> _Query:
        self._op = "select"
        return self

    def update(self, payload: dict[str, Any]) -> _Query:
        self._op = "update"
        self._payload = payload
        return self

    def insert(self, payload: Any) -> _Query:
        self._op = "insert"
        self._payload = payload
        return self

    def delete(self) -> _Query:
        self._op = "delete"
        return self

    def upsert(self, payload: Any, **_kwargs: Any) -> _Query:
        self._op = "upsert"
        self._payload = payload
        return self

    # --- filters / modifiers (recorded, not applied) ---
    def eq(self, column: str, value: Any) -> _Query:
        self._filters.append((f"eq:{column}", value))
        return self

    def in_(self, column: str, values: Any) -> _Query:
        self._filters.append((f"in:{column}", values))
        return self

    def is_(self, column: str, value: Any) -> _Query:
        self._filters.append((f"is:{column}", value))
        return self

    def contains(self, column: str, value: Any) -> _Query:
        self._filters.append((f"contains:{column}", value))
        return self

    def order(self, *_args: Any, **_kwargs: Any) -> _Query:
        return self

    def limit(self, *_args: Any) -> _Query:
        return self

    def range(self, *_args: Any) -> _Query:
        return self

    def single(self) -> _Query:
        self._single = True
        return self

    def execute(self) -> _Result:
        self._client.calls.append(
            {
                "table": self._table,
                "op": self._op,
                "payload": self._payload,
                "filters": self._filters,
            }
        )
        if self._op == "select":
            return _Result(self._client.tables.get(self._table, []))
        if self._op == "delete":
            return _Result(self._client.tables.get(self._table, []))
        return _Result(self._client.tables.get(self._table, [{}]))


class _Rpc:
    def __init__(self, data: Any) -> None:
        self._data = data

    def execute(self) -> _Result:
        return _Result(self._data)


class _Bucket:
    def __init__(self, client: FakeSupabaseClient, name: str) -> None:
        self._client = client
        self._name = name

    def remove(self, paths: list[str]) -> None:
        if self._name in self._client.failing_buckets:
            raise RuntimeError(f"bucket {self._name} unavailable")
        self._client.removed_blobs.extend((self._name, p) for p in paths)


class _Storage:
    def __init__(self, client: FakeSupabaseClient) -> None:
        self._client = client

    def from_(self, name: str) -> _Bucket:
        return _Bucket(self._client, name)


class FakeSupabaseClient:
    def __init__(
        self,
        tables: dict[str, list[dict[str, Any]]] | None = None,
        rpc_results: dict[str, Any] | None = None,
        failing_buckets: set[str] | None = None,
    ) -> None:
        self.tables = tables or {}
        self.rpc_results = rpc_results or {}
        self.failing_buckets = failing_buckets or set()
        self.calls: list[dict[str, Any]] = []
        self.rpc_calls: list[tuple[str, dict[str, Any]]] = []
        self.removed_blobs: list[tuple[str, str]] = []
        self.storage = _Storage(self)

    def table(self, name: str) -> _Query:
        return _Query(self, name)

    def rpc(self, name: str, params: dict[str, Any]) -> _Rpc:
        self.rpc_calls.append((name, params))
        return _Rpc(self.rpc_results.get(name, 0))

    # --- assertions helpers ---
    def writes_to(self, table: str) -> list[dict[str, Any]]:
        return [c for c in self.calls if c["table"] == table and c["op"] in {"update", "insert", "upsert"}]

    def deletes_from(self, table: str) -> list[dict[str, Any]]:
        return [c for c in self.calls if c["table"] == table and c["op"] == "delete"]

    def rpc_params(self, name: str) -> dict[str, Any]:
        for called, params in self.rpc_calls:
            if called == name:
                return params
        raise AssertionError(f"rpc {name} was never called; got {[n for n, _ in self.rpc_calls]}")
