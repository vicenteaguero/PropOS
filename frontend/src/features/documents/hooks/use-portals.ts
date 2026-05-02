import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { portalsApi, type CreatePortalInput, type PromoteUploadInput } from "../api/portals-api";

export const portalsKeys = {
  all: ["portals"] as const,
  detail: (id: string) => ["portals", "detail", id] as const,
  uploads: (id: string) => ["portals", "uploads", id] as const,
};

export function usePortals() {
  return useQuery({ queryKey: portalsKeys.all, queryFn: () => portalsApi.list() });
}

export function usePortal(id: string | undefined) {
  return useQuery({
    queryKey: portalsKeys.detail(id ?? ""),
    queryFn: () => portalsApi.get(id as string),
    enabled: !!id,
  });
}

export function usePortalUploads(portalId: string | undefined) {
  return useQuery({
    queryKey: portalsKeys.uploads(portalId ?? ""),
    queryFn: () => portalsApi.uploads(portalId as string),
    enabled: !!portalId,
  });
}

export function useCreatePortal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePortalInput) => portalsApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: portalsKeys.all }),
  });
}

export function useUpdatePortal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      body: Partial<CreatePortalInput> & { is_active?: boolean; clear_password?: boolean };
    }) => portalsApi.update(input.id, input.body),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: portalsKeys.all });
      qc.invalidateQueries({ queryKey: portalsKeys.detail(vars.id) });
    },
  });
}

export function useDeletePortal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => portalsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: portalsKeys.all }),
  });
}

export function usePromoteUpload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { uploadId: string; body: PromoteUploadInput; portalId: string }) =>
      portalsApi.promote(input.uploadId, input.body),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: portalsKeys.uploads(vars.portalId) });
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

export function useRejectUpload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { uploadId: string; portalId: string }) =>
      portalsApi.reject(input.uploadId),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: portalsKeys.uploads(vars.portalId) });
    },
  });
}
