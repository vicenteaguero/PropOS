import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  notesApi,
  type Note,
  type NoteInput,
  type NoteTargetInput,
  type NotesQuery,
} from "../api/notes-api";

export const notesKeys = {
  all: ["notes"] as const,
  list: (params: NotesQuery) => ["notes", "list", params] as const,
};

export function useNotes(params: NotesQuery = {}) {
  return useQuery({
    queryKey: notesKeys.list(params),
    queryFn: () => notesApi.list(params),
    staleTime: 20_000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Notes attached to one record, for an entity detail page.
 *
 * Matches both link generations server-side (`note_targets` rows and the legacy
 * `target_table`/`target_row_id` pair), so a page gets every note about the
 * record regardless of which writer created the link.
 */
export function useEntityNotes(targetTable: string | undefined, targetRowId: string | undefined) {
  const params = { target_table: targetTable, target_row_id: targetRowId };
  return useQuery({
    queryKey: notesKeys.list(params),
    queryFn: () => notesApi.list(params),
    enabled: !!targetTable && !!targetRowId,
    staleTime: 20_000,
    refetchOnWindowFocus: false,
  });
}

const fail = (fallback: string) => (err: unknown) =>
  toast.error(err instanceof Error ? err.message : fallback);

export function useCreateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: NoteInput) => notesApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: notesKeys.all }),
    onError: fail("No se pudo guardar la nota"),
  });
}

export function useUpdateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: { body?: string; priority?: number; pinned?: boolean; color?: string | null };
    }) => notesApi.update(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: notesKeys.all }),
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "No se pudo guardar la nota"),
  });
}

export function useDeleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notesApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: notesKeys.all }),
    onError: fail("No se pudo eliminar"),
  });
}

export function useAddNoteTargets() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ noteId, targets }: { noteId: string; targets: NoteTargetInput[] }) =>
      notesApi.addTargets(noteId, targets),
    onSuccess: () => qc.invalidateQueries({ queryKey: notesKeys.all }),
    onError: fail("No se pudo vincular"),
  });
}

export function useRemoveNoteTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ noteId, targetId }: { noteId: string; targetId: string }) =>
      notesApi.removeTarget(noteId, targetId),
    onSuccess: () => qc.invalidateQueries({ queryKey: notesKeys.all }),
    onError: fail("No se pudo desvincular"),
  });
}

export function useUploadNoteAttachments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ noteId, files }: { noteId: string; files: Blob[] }) =>
      notesApi.uploadAttachments(noteId, files),
    onSuccess: () => qc.invalidateQueries({ queryKey: notesKeys.all }),
    onError: fail("No se pudieron subir los adjuntos"),
  });
}

export function useRemoveNoteAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ noteId, assetId }: { noteId: string; assetId: string }) =>
      notesApi.removeAttachment(noteId, assetId),
    onSuccess: () => qc.invalidateQueries({ queryKey: notesKeys.all }),
    onError: fail("No se pudo eliminar el adjunto"),
  });
}

/**
 * Create a note and, when the composer staged files, upload them to it.
 *
 * Attachments need a note id, so the note is written first and the upload
 * follows. A failed upload leaves the note in place rather than rolling it
 * back — the text is the part the broker cannot retype from memory.
 */
export function useCreateNoteWithAttachments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ input, files }: { input: NoteInput; files: Blob[] }): Promise<Note> => {
      const note = await notesApi.create(input);
      if (files.length > 0) await notesApi.uploadAttachments(note.id, files);
      return note;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: notesKeys.all }),
    onError: fail("No se pudo guardar la nota"),
  });
}
