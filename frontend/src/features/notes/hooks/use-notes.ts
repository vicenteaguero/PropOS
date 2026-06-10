import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { notesApi, type NoteInput } from "../api/notes-api";

export const notesKeys = {
  all: ["notes"] as const,
  list: (params: { target_table?: string; target_row_id?: string }) =>
    ["notes", "list", params] as const,
};

export function useNotes(params: { target_table?: string; target_row_id?: string } = {}) {
  return useQuery({
    queryKey: notesKeys.list(params),
    queryFn: () => notesApi.list(params),
    staleTime: 20_000,
    refetchOnWindowFocus: false,
  });
}

export function useCreateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: NoteInput) => notesApi.create(body),
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
    onError: (err) => toast.error(err instanceof Error ? err.message : "No se pudo eliminar"),
  });
}
