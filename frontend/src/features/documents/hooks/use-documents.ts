import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { documentsApi, type ListDocumentsParams } from "../api/documents-api";
import type { AssignmentTarget } from "../types";

export const documentsKeys = {
  all: ["documents"] as const,
  list: (params: ListDocumentsParams) => ["documents", "list", params] as const,
  detail: (id: string) => ["documents", "detail", id] as const,
};

export function useDocuments(params: ListDocumentsParams = {}) {
  return useQuery({
    queryKey: documentsKeys.list(params),
    queryFn: () => documentsApi.list(params),
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
    mutationFn: (input: { file: File; displayName: string; origin?: string; downloadFilename?: string }) =>
      documentsApi.create(input.file, input.displayName, input.origin, input.downloadFilename),
    onSuccess: () => qc.invalidateQueries({ queryKey: documentsKeys.all }),
  });
}

export function useUpdateDocument(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { display_name?: string; sort_order?: number }) =>
      documentsApi.update(id, body),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: documentsKeys.all }),
  });
}

export function useAddVersion(documentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { file: File; notes?: string; downloadFilename?: string }) =>
      documentsApi.addVersion(documentId, input.file, input.notes, input.downloadFilename),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: documentsKeys.detail(documentId) });
      qc.invalidateQueries({ queryKey: documentsKeys.all });
    },
  });
}

export function useMakeVersionCurrent(documentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (versionId: string) =>
      documentsApi.makeVersionCurrent(documentId, versionId),
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
    mutationFn: (assignmentId: string) =>
      documentsApi.removeAssignment(documentId, assignmentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: documentsKeys.detail(documentId) });
    },
  });
}
