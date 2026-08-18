import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { importsApi } from "../api/imports-api";

export const importsKeys = {
  all: ["imports"] as const,
  list: () => ["imports", "list"] as const,
};

/** Past import jobs (PREVIEW + COMMITTED), newest first per the backend. */
export function useImports() {
  return useQuery({
    queryKey: importsKeys.list(),
    queryFn: () => importsApi.list(),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

/** Uploads the CSV and stages it — the job row shows up in the history as PREVIEW. */
export function usePreviewImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ entity, file }: { entity: string; file: File }) =>
      importsApi.preview(entity, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: importsKeys.all }),
  });
}

export function useCommitImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (importId: string) => importsApi.commit(importId),
    onSuccess: () => qc.invalidateQueries({ queryKey: importsKeys.all }),
  });
}
