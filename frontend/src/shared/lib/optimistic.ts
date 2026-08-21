import type { QueryClient, QueryKey } from "@tanstack/react-query";

/**
 * Optimistic cache edits, so a write feels done before the network agrees.
 *
 * Most mutations in this app waited for the round trip and then invalidated —
 * around a second before a checkbox ticked or a card moved column, all of it
 * network. These helpers write the expected result into the cache first and
 * roll back if the server disagrees.
 *
 * The prefix-scoped variants are the ones to reach for. Query keys here are
 * hierarchies (`["tasks"]`, `["tasks", filters]`, `["deals","detail",id]`), so
 * a single exact key almost never covers every cached view of the thing being
 * changed — the list a user is looking at is usually keyed by its filters.
 */

/** One cached query's key and its value before we touched it. */
export interface Snapshot {
  key: QueryKey;
  data: unknown;
}

/**
 * Apply `edit` to every cached query under `keyPrefix`, returning what to undo.
 *
 * `edit` receives whatever each matching query holds, which is NOT necessarily
 * a list: `["tasks"]` matches both the list and any detail query beneath it. It
 * must therefore check the shape it got before assuming. Getting this wrong is
 * not a cosmetic bug — an exception thrown inside `onMutate` aborts the
 * mutation before `mutationFn` ever runs, so the write silently does not
 * happen.
 */
export function editByPrefix(
  qc: QueryClient,
  keyPrefix: QueryKey,
  edit: (data: unknown) => unknown,
): Snapshot[] {
  const snapshots: Snapshot[] = [];
  for (const [key, data] of qc.getQueriesData({ queryKey: keyPrefix })) {
    if (data === undefined) continue;
    snapshots.push({ key, data });
    qc.setQueryData(key, edit(data));
  }
  return snapshots;
}

/** Put back everything `editByPrefix` changed. */
export function rollbackAll(qc: QueryClient, snapshots: Snapshot[] | undefined): void {
  for (const { key, data } of snapshots ?? []) {
    if (data !== undefined) qc.setQueryData(key, data);
  }
}

/**
 * Patch the row with `id` wherever it appears — in a list, or on its own.
 *
 * Guarded on both shapes because a key prefix matches both, and returns the
 * input untouched for anything else rather than throwing. See `editByPrefix`.
 */
export function patchById(data: unknown, id: string, patch: object): unknown {
  const matches = (item: unknown) =>
    !!item && typeof item === "object" && (item as { id?: string }).id === id;

  if (Array.isArray(data)) {
    return data.map((item) => (matches(item) ? { ...item, ...patch } : item));
  }
  if (matches(data)) return { ...(data as object), ...patch };
  return data;
}

/** Drop the row with `id` from any list; leave anything else alone. */
export function removeById(data: unknown, id: string): unknown {
  if (!Array.isArray(data)) return data;
  return data.filter((item) => !(item && typeof item === "object" && item.id === id));
}

/** Add `row` to the front of any list; leave anything else alone. */
export function prependRow<T>(data: unknown, row: T): unknown {
  if (!Array.isArray(data)) return data;
  return [row, ...data];
}
