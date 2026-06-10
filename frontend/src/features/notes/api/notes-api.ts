import { apiRequest } from "@features/documents/api/http";

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

function qs(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const notesApi = {
  list: (params: { target_table?: string; target_row_id?: string } = {}) =>
    apiRequest<Note[]>(`/v1/notes${qs({ ...params })}`),
  create: (body: NoteInput) => apiRequest<Note>("/v1/notes", { method: "POST", body }),
  remove: (id: string) => apiRequest<void>(`/v1/notes/${id}`, { method: "DELETE" }),
};
