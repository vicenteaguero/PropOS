import { apiRequest } from "@features/documents/api/http";

export type TaskStatus = "OPEN" | "IN_PROGRESS" | "BLOCKED" | "DONE" | "CANCELLED";
export type TaskKind = "TODO" | "PENDING" | "GOAL" | "OBJECTIVE" | "PLAN";

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
  related: Record<string, unknown>;
  created_at: string;
}

export interface TaskInput {
  title: string;
  kind?: TaskKind;
  description?: string | null;
  due_at?: string | null;
  priority?: number;
  status?: TaskStatus;
}

function qs(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const tasksApi = {
  list: (params: { only_open?: boolean; status?: string } = {}) =>
    apiRequest<Task[]>(`/v1/tasks${qs({ ...params })}`),
  create: (body: TaskInput) => apiRequest<Task>("/v1/tasks", { method: "POST", body }),
  update: (id: string, body: Partial<TaskInput>) =>
    apiRequest<Task>(`/v1/tasks/${id}`, { method: "PATCH", body }),
  remove: (id: string) => apiRequest<void>(`/v1/tasks/${id}`, { method: "DELETE" }),
};
