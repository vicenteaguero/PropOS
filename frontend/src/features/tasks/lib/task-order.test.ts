import { describe, expect, it } from "vitest";
import { matchesPriority, priorityBucket, sortTasks } from "./task-order";
import type { Task } from "../api/tasks-api";

function task(over: Partial<Task> & { id: string }): Task {
  return {
    tenant_id: "t",
    kind: "TODO",
    title: over.id,
    description: null,
    status: "OPEN",
    priority: 0,
    due_at: null,
    completed_at: null,
    related: {},
    owner_user: null,
    created_at: "2026-01-01T00:00:00Z",
    ...over,
  } as Task;
}

const ids = (list: Task[]) => list.map((t) => t.id);

describe("priorityBucket", () => {
  it("treats anything above 1 as high", () => {
    // The column is a bare SMALLINT and the seed writes 3.
    expect(priorityBucket(3)).toBe(2);
    expect(priorityBucket(2)).toBe(2);
  });

  it("maps 1 to medium and everything else to normal", () => {
    expect(priorityBucket(1)).toBe(1);
    expect(priorityBucket(0)).toBe(0);
    expect(priorityBucket(null)).toBe(0);
    expect(priorityBucket(undefined)).toBe(0);
  });
});

describe("matchesPriority", () => {
  it("matches by bucket, not by value", () => {
    expect(matchesPriority(task({ id: "a", priority: 3 }), "high")).toBe(true);
    expect(matchesPriority(task({ id: "a", priority: 3 }), "normal")).toBe(false);
  });

  it("lets everything through when unfiltered", () => {
    expect(matchesPriority(task({ id: "a", priority: 1 }), "all")).toBe(true);
  });
});

describe("sortTasks", () => {
  it("sinks completed tasks whatever the order", () => {
    const list = [task({ id: "done", status: "DONE", priority: 3 }), task({ id: "open" })];
    expect(ids(sortTasks(list, "priority"))).toEqual(["open", "done"]);
  });

  it("orders by priority bucket when asked", () => {
    const list = [task({ id: "low" }), task({ id: "high", priority: 3 })];
    expect(ids(sortTasks(list, "priority"))).toEqual(["high", "low"]);
  });

  it("puts undated tasks last when ordering by due date", () => {
    const list = [task({ id: "undated" }), task({ id: "soon", due_at: "2026-02-01T00:00:00Z" })];
    expect(ids(sortTasks(list, "due"))).toEqual(["soon", "undated"]);
  });

  it("orders by newest when asked", () => {
    const list = [
      task({ id: "old", created_at: "2026-01-01T00:00:00Z" }),
      task({ id: "new", created_at: "2026-06-01T00:00:00Z" }),
    ];
    expect(ids(sortTasks(list, "created"))).toEqual(["new", "old"]);
  });

  it("does not mutate its input", () => {
    const list = [task({ id: "b" }), task({ id: "a", priority: 3 })];
    sortTasks(list, "priority");
    expect(ids(list)).toEqual(["b", "a"]);
  });
});
