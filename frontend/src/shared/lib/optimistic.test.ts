import { describe, expect, it, vi } from "vitest";
import { editByPrefix, patchById, prependRow, removeById, rollbackAll } from "./optimistic";
import type { QueryClient } from "@tanstack/react-query";

/**
 * The guards matter more than the happy paths.
 *
 * A key prefix like `["tasks"]` matches the list AND every detail query under
 * it, so an edit function is handed objects as often as arrays. Assuming a list
 * throws, and a throw inside `onMutate` aborts the mutation before it ever
 * reaches the network — the write silently does not happen and the UI shows an
 * optimistic result that will never be confirmed.
 */

function fakeClient(entries: [unknown[], unknown][]) {
  const store = new Map(entries.map(([k, v]) => [JSON.stringify(k), v]));
  return {
    getQueriesData: () => entries.map(([k]) => [k, store.get(JSON.stringify(k))]),
    setQueryData: vi.fn((key: unknown[], data: unknown) => {
      store.set(JSON.stringify(key), data);
    }),
    read: (key: unknown[]) => store.get(JSON.stringify(key)),
  };
}

describe("patchById", () => {
  it("patches a row inside a list", () => {
    const out = patchById([{ id: "a", done: false }, { id: "b" }], "a", { done: true });
    expect(out).toEqual([{ id: "a", done: true }, { id: "b" }]);
  });

  it("patches a bare object when the key pointed at a detail query", () => {
    expect(patchById({ id: "a", done: false }, "a", { done: true })).toEqual({
      id: "a",
      done: true,
    });
  });

  it("leaves an unrelated object alone instead of throwing", () => {
    const other = { id: "z", done: false };
    expect(patchById(other, "a", { done: true })).toBe(other);
  });

  it("survives a shape it does not understand", () => {
    expect(patchById(null, "a", {})).toBe(null);
    expect(patchById("nonsense", "a", {})).toBe("nonsense");
    expect(patchById([null, undefined, 3], "a", {})).toEqual([null, undefined, 3]);
  });
});

describe("removeById", () => {
  it("drops the row", () => {
    expect(removeById([{ id: "a" }, { id: "b" }], "a")).toEqual([{ id: "b" }]);
  });

  it("returns a non-list untouched", () => {
    const detail = { id: "a" };
    expect(removeById(detail, "a")).toBe(detail);
  });
});

describe("prependRow", () => {
  it("puts the new row first, where a user expects to see it", () => {
    expect(prependRow([{ id: "b" }], { id: "a" })).toEqual([{ id: "a" }, { id: "b" }]);
  });

  it("returns a non-list untouched", () => {
    expect(prependRow(undefined, { id: "a" })).toBe(undefined);
  });
});

describe("editByPrefix / rollbackAll", () => {
  it("edits every matching query and can put them all back", () => {
    const qc = fakeClient([
      [["tasks", { open: true }], [{ id: "a", status: "OPEN" }]],
      [["tasks", "detail", "a"], { id: "a", status: "OPEN" }],
    ]);

    const snapshots = editByPrefix(qc as unknown as QueryClient, ["tasks"], (data) =>
      patchById(data, "a", { status: "DONE" }),
    );

    expect(qc.read(["tasks", { open: true }])).toEqual([{ id: "a", status: "DONE" }]);
    expect(qc.read(["tasks", "detail", "a"])).toEqual({ id: "a", status: "DONE" });

    rollbackAll(qc as unknown as QueryClient, snapshots);
    expect(qc.read(["tasks", { open: true }])).toEqual([{ id: "a", status: "OPEN" }]);
    expect(qc.read(["tasks", "detail", "a"])).toEqual({ id: "a", status: "OPEN" });
  });

  it("skips queries that hold nothing, so rollback cannot resurrect them", () => {
    const qc = fakeClient([[["tasks", "cold"], undefined]]);

    const snapshots = editByPrefix(qc as unknown as QueryClient, ["tasks"], () => "edited");

    expect(snapshots).toEqual([]);
    expect(qc.setQueryData).not.toHaveBeenCalled();
  });

  it("rolls back cleanly when handed nothing", () => {
    const qc = fakeClient([]);
    expect(() => rollbackAll(qc as unknown as QueryClient, undefined)).not.toThrow();
  });
});
