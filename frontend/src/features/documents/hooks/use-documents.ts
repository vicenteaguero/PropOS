import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { documentsApi, type ListDocumentsParams } from "../api/documents-api";
import type { AssignmentTarget, DocumentItem } from "../types";
import { toast } from "sonner";

export const documentsKeys = {
  all: ["documents"] as const,
  list: (params: ListDocumentsParams) => ["documents", "list", params] as const,
  detail: (id: string) => ["documents", "detail", id] as const,
};

export function useDocuments(params: ListDocumentsParams = {}) {
  return useQuery({
    queryKey: documentsKeys.list(params),
    queryFn: () => documentsApi.list(params),
    // List endpoint returns metadata only; cache aggressively to avoid 20s
    // hard-reload waterfalls on every navigation back to the documents page.
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useDocument(id: string | undefined) {
  return useQuery({
    queryKey: documentsKeys.detail(id ?? ""),
    queryFn: () => documentsApi.get(id as string),
    enabled: !!id,
  });
}

export function useCreateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      file: File;
      displayName: string;
      origin?: string;
      downloadFilename?: string;
      sourceImages?: Blob[];
      sourceEditStates?: Record<string, unknown>[];
      tag?: string;
    }) =>
      documentsApi.create(
        input.file,
        input.displayName,
        input.origin,
        input.downloadFilename,
        undefined,
        input.sourceImages,
        input.sourceEditStates,
        input.tag,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: documentsKeys.all }),
  });
}

export function useUpdateDocument(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      display_name?: string;
      sort_order?: number;
      tag?: string | null;
      pin_offline?: boolean;
    }) => documentsApi.update(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: documentsKeys.all });
      qc.invalidateQueries({ queryKey: documentsKeys.detail(id) });
    },
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => documentsApi.remove(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: documentsKeys.all });
      const snapshots: Array<{ key: readonly unknown[]; data: DocumentItem[] | undefined }> = [];
      const queries = qc.getQueriesData<DocumentItem[]>({ queryKey: ["documents", "list"] });
      for (const [key, data] of queries) {
        snapshots.push({ key, data });
        if (data) {
          qc.setQueryData<DocumentItem[]>(
            key,
            data.filter((d) => d.id !== id),
          );
        }
      }
      return { snapshots };
    },
    onError: (_err, _id, ctx) => {
      ctx?.snapshots.forEach(({ key, data }) => {
        if (data) qc.setQueryData(key, data);
      });
      toast.error("No se pudo eliminar el documento");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: documentsKeys.all }),
  });
}

export function useAddVersion(documentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      file: File;
      notes?: string;
      downloadFilename?: string;
      editMetadata?: Record<string, unknown>;
      sourceVersionId?: string;
      sourceImages?: Blob[];
      sourceEditStates?: Record<string, unknown>[];
    }) =>
      documentsApi.addVersion(documentId, input.file, {
        notes: input.notes,
        downloadFilename: input.downloadFilename,
        editMetadata: input.editMetadata,
        sourceVersionId: input.sourceVersionId,
        sourceImages: input.sourceImages,
        sourceEditStates: input.sourceEditStates,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: documentsKeys.detail(documentId) });
      qc.invalidateQueries({ queryKey: documentsKeys.all });
    },
  });
}

export function useRestoreOriginal(documentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (versionId: string) => documentsApi.restoreOriginal(documentId, versionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: documentsKeys.detail(documentId) });
      qc.invalidateQueries({ queryKey: documentsKeys.all });
    },
  });
}

export function useMakeVersionCurrent(documentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (versionId: string) => documentsApi.makeVersionCurrent(documentId, versionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: documentsKeys.detail(documentId) });
    },
  });
}

export function useAddAssignment(documentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      target_kind: AssignmentTarget;
      contact_id?: string;
      property_id?: string;
      internal_area_id?: string;
    }) => documentsApi.addAssignment(documentId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: documentsKeys.detail(documentId) });
      qc.invalidateQueries({ queryKey: documentsKeys.all });
    },
  });
}

export function useRemoveAssignment(documentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (assignmentId: string) => documentsApi.removeAssignment(documentId, assignmentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: documentsKeys.detail(documentId) });
    },
  });
}
