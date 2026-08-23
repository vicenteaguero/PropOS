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
  /**
   * Deals. Added because a task about a closing had nowhere to say which
   * closing — the key did not exist, and neither did the label resolution
   * behind it (`tasks/service.py::_deal_labels`).
   */
  opportunities?: string[];
  /**
   * Links, as a field rather than as prose to be mined.
   *
   * They used to be found by running a regex over `description`, which meant a
   * link could not be added without editing the paragraph around it, could not
   * be removed at all, and vanished when someone rewrote the sentence it lived
   * in. `related` is JSONB, so this needed no migration.
   */
  links?: string[];
}

export interface TaskAttachment {
  id: string;
  media_file_id: string;
  role: "PHOTO" | "AUDIO";
  position: number;
  url: string;
  thumb_url?: string | null;
  card_url?: string | null;
  title?: string | null;
  created_at?: string | null;
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
  /** Photos and voice memos — the same `media_assets` rows notes use. */
  attachments?: TaskAttachment[];
  /** Names for the ids in `related`, resolved server-side. */
  related_labels?: {
    properties?: { id: string; label: string | null }[];
    people?: { id: string; label: string | null }[];
    opportunities?: { id: string; label: string | null }[];
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

  attachments: {
    upload: (taskId: string, files: Blob[]) => {
      const fd = new FormData();
      files.forEach((f, i) => fd.append("files", f, (f as File).name ?? `adjunto-${i}`));
      return apiRequest<TaskAttachment[]>(`/v1/tasks/${taskId}/attachments`, {
        method: "POST",
        formData: fd,
      });
    },
    remove: (taskId: string, assetId: string) =>
      apiRequest<void>(`/v1/tasks/${taskId}/attachments/${assetId}`, { method: "DELETE" }),
  },
};
