import { apiRequest } from "@shared/api/http";
import { qs } from "@shared/lib/query-string";

/** Tables a reminder can point at (mirrors `ReminderTargetTable` on the backend). */
export type ReminderTargetTable = "events" | "tasks" | "transactions";

export interface Reminder {
  id: string;
  tenant_id: string;
  target_table: ReminderTargetTable;
  target_row_id: string;
  user_id: string;
  remind_at: string;
  channel: string;
  message: string | null;
  url: string | null;
  status: string;
  sent_at: string | null;
  created_at: string;
}

export interface ReminderInput {
  target_table: ReminderTargetTable;
  target_row_id: string;
  remind_at: string;
  message?: string | null;
  url?: string | null;
  /** Defaults to the creating user on the backend. */
  user_id?: string | null;
}

/**
 * Reminders drive the push dispatcher: a row here is what makes a task or an
 * event notify. `TaskCreate` has no `remind_at` (unlike `EventCreate`), so the
 * task form has to create the reminder as a second call after the task exists.
 */
export const remindersApi = {
  list: (params: { target_table?: ReminderTargetTable; target_row_id?: string } = {}) =>
    apiRequest<Reminder[]>(`/v1/reminders${qs({ ...params })}`),
  create: (body: ReminderInput) => apiRequest<Reminder>("/v1/reminders", { method: "POST", body }),
  remove: (id: string) => apiRequest<void>(`/v1/reminders/${id}`, { method: "DELETE" }),
};
