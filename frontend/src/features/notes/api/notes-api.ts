import { apiRequest } from "@shared/api/http";
import { qs } from "@shared/lib/query-string";

export interface Note {
  id: string;
  tenant_id: string;
  body: string;
  target_table: string | null;
  target_row_id: string | null;
  source: string;
  created_by: string | null;
  created_at: string;
}

export interface NoteInput {
  body: string;
  target_table?: string | null;
  target_row_id?: string | null;
}

export const notesApi = {
  list: (params: { target_table?: string; target_row_id?: string } = {}) =>
    apiRequest<Note[]>(`/v1/notes${qs({ ...params })}`),
  create: (body: NoteInput) => apiRequest<Note>("/v1/notes", { method: "POST", body }),
  remove: (id: string) => apiRequest<void>(`/v1/notes/${id}`, { method: "DELETE" }),
};
