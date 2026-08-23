import { apiRequest } from "@shared/api/http";
import { qs } from "@shared/lib/query-string";

/** The record kinds a note can point at — mirrors the `note_targets` enum. */
export type NoteTargetKind = "PROPERTY" | "CONTACT" | "OPPORTUNITY" | "EVENT" | "PROJECT" | "PLACE";

/**
 * A link resolved server-side: which record, and what it is called. The backend
 * batches the name lookup for the whole page, so the client never resolves ids.
 *
 * `id` is the `note_targets` row, or the literal "legacy" for a note that still
 * only carries the old `target_table`/`target_row_id` pair.
 */
export interface NoteTarget {
  id: string;
  kind: NoteTargetKind;
  row_id: string;
  target_table: string;
  label: string;
  /** False when the record is gone; `label` is then a generic placeholder. */
  resolved: boolean;
}

/** A photo or voice memo. URLs are signed and expire within the hour. */
export interface NoteAttachment {
  id: string;
  media_file_id: string;
  role: "PHOTO" | "AUDIO";
  position: number;
  url: string;
  thumb_url: string | null;
  card_url: string | null;
  title: string | null;
  created_at: string | null;
}

export interface Note {
  id: string;
  tenant_id: string;
  body: string;
  target_table: string | null;
  target_row_id: string | null;
  source: string;
  created_by: string | null;
  created_at: string;
  targets: NoteTarget[];
  attachments: NoteAttachment[];
  /** 0 normal · 1 media · 2+ alta, same reading as a task's priority. */
  priority?: number;
  pinned?: boolean;
  color?: string | null;
  updated_at?: string;
}

export interface NoteTargetInput {
  kind: NoteTargetKind;
  row_id: string;
}

export interface NoteInput {
  body: string;
  target_table?: string | null;
  target_row_id?: string | null;
  targets?: NoteTargetInput[];
}

export interface NotesQuery {
  target_table?: string;
  target_row_id?: string;
}

export const notesApi = {
  list: (params: NotesQuery = {}) => apiRequest<Note[]>(`/v1/notes${qs({ ...params })}`),
  create: (body: NoteInput) => apiRequest<Note>("/v1/notes", { method: "POST", body }),
  update: (
    id: string,
    body: { body?: string; priority?: number; pinned?: boolean; color?: string | null },
  ) => apiRequest<Note>(`/v1/notes/${id}`, { method: "PATCH", body }),
  remove: (id: string) => apiRequest<void>(`/v1/notes/${id}`, { method: "DELETE" }),

  addTargets: (id: string, targets: NoteTargetInput[]) =>
    apiRequest<NoteTarget[]>(`/v1/notes/${id}/targets`, { method: "POST", body: targets }),
  removeTarget: (id: string, targetId: string) =>
    apiRequest<void>(`/v1/notes/${id}/targets/${targetId}`, { method: "DELETE" }),

  attachments: (id: string) => apiRequest<NoteAttachment[]>(`/v1/notes/${id}/attachments`),
  uploadAttachments: (id: string, files: Blob[]) => {
    const fd = new FormData();
    // A recorded memo is a bare Blob with no name; the backend only uses the
    // filename for the title and the extension fallback.
    files.forEach((file, i) =>
      fd.append("files", file, file instanceof File ? file.name : `nota-${i}.webm`),
    );
    return apiRequest<NoteAttachment[]>(`/v1/notes/${id}/attachments`, {
      method: "POST",
      formData: fd,
    });
  },
  removeAttachment: (id: string, assetId: string) =>
    apiRequest<void>(`/v1/notes/${id}/attachments/${assetId}`, { method: "DELETE" }),
};
