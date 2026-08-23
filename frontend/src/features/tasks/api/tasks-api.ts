import { apiRequest } from "@shared/api/http";
import { qs } from "@shared/lib/query-string";

export type TaskStatus = "OPEN" | "IN_PROGRESS" | "BLOCKED" | "DONE" | "CANCELLED";
export type TaskKind = "TODO" | "PENDING" | "GOAL" | "OBJECTIVE" | "PLAN";

/**
 * Polymorphic entity links on a task. Keys mirror what the agent dispatcher
 * writes into `tasks.related` — `people` holds contact ids, not profile ids.
 */
export interface TaskRelated {
  properties?: string[];
  people?: string[];
  projects?: string[];
}

export interface Task {
  id: string;
  tenant_id: string;
  kind: TaskKind;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: number;
  due_at: string | null;
  completed_at: string | null;
  related: TaskRelated;
  /** Profile id of whoever owns this task. Null = nobody claimed it. */
  owner_user: string | null;
  /** Names for the ids in `related`, resolved server-side. */
  related_labels?: {
    properties?: { id: string; label: string | null }[];
    people?: { id: string; label: string | null }[];
  };
  created_at: string;
}

export interface TaskInput {
  title: string;
  kind?: TaskKind;
  description?: string | null;
  due_at?: string | null;
  priority?: number;
  status?: TaskStatus;
  related?: TaskRelated;
  owner_user?: string | null;
}

export const tasksApi = {
  list: (params: { only_open?: boolean; status?: string; owner_user?: string } = {}) =>
    apiRequest<Task[]>(`/v1/tasks${qs({ ...params })}`),
  get: (id: string) => apiRequest<Task>(`/v1/tasks/${id}`),
  create: (body: TaskInput) => apiRequest<Task>("/v1/tasks", { method: "POST", body }),
  update: (id: string, body: Partial<TaskInput>) =>
    apiRequest<Task>(`/v1/tasks/${id}`, { method: "PATCH", body }),
  remove: (id: string) => apiRequest<void>(`/v1/tasks/${id}`, { method: "DELETE" }),
};
