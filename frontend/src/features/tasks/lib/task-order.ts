import type { Task } from "../api/tasks-api";

/**
 * `tasks.priority` is a bare SMALLINT with no check constraint and rows carry 3
 * and above, so everything reads it as a range rather than a set of values.
 */
export function priorityBucket(value: number | null | undefined): 0 | 1 | 2 {
  if (!value || value <= 0) return 0;
  return value === 1 ? 1 : 2;
}

export type TaskOrder = "due" | "priority" | "created";

export const TASK_ORDERS: { value: TaskOrder; label: string; sub: string }[] = [
  { value: "due", label: "Por vencimiento", sub: "Lo que vence antes" },
  { value: "priority", label: "Por prioridad", sub: "Las importantes arriba" },
  { value: "created", label: "Más nuevas", sub: "Últimas creadas" },
];

export type TaskPriorityFilter = "all" | "high" | "medium" | "normal";

export const TASK_PRIORITY_FILTERS: { value: TaskPriorityFilter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "high", label: "Alta" },
  { value: "medium", label: "Media" },
  { value: "normal", label: "Normal" },
];

const BUCKET_FOR: Record<Exclude<TaskPriorityFilter, "all">, 0 | 1 | 2> = {
  high: 2,
  medium: 1,
  normal: 0,
};

export function matchesPriority(task: Task, filter: TaskPriorityFilter): boolean {
  return filter === "all" || priorityBucket(task.priority) === BUCKET_FOR[filter];
}

/**
 * Order within a period.
 *
 * Completed tasks always sink, whatever the order — the point of ticking one
 * off is that it stops competing for attention. Everything else follows the
 * chosen key, and ties fall back to the due date so the list never jitters
 * between renders.
 */
export function sortTasks(tasks: Task[], order: TaskOrder): Task[] {
  const time = (v: string | null | undefined) => (v ? Date.parse(v) : Number.POSITIVE_INFINITY);
  const created = (v: string | null | undefined) => (v ? Date.parse(v) : 0);
  return [...tasks].sort((a, b) => {
    const done = Number(a.status === "DONE") - Number(b.status === "DONE");
    if (done !== 0) return done;
    if (order === "priority") {
      const p = priorityBucket(b.priority) - priorityBucket(a.priority);
      if (p !== 0) return p;
    }
    if (order === "created") return created(b.created_at) - created(a.created_at);
    return time(a.due_at) - time(b.due_at);
  });
}
