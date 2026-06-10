import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { interactionsApi, type ListInteractionsParams } from "../api/interactions-api";
import type { InteractionInput } from "../types";

export const interactionsKeys = {
  all: ["interactions"] as const,
  list: (params: ListInteractionsParams) => ["interactions", "list", params] as const,
};

export function useInteractions(params: ListInteractionsParams = {}) {
  return useQuery({
    queryKey: interactionsKeys.list(params),
    queryFn: () => interactionsApi.list(params),
    staleTime: 20_000,
    refetchOnWindowFocus: false,
  });
}

export function useCreateInteraction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: InteractionInput) => interactionsApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: interactionsKeys.all }),
    onError: (err) => toast.error(err instanceof Error ? err.message : "No se pudo registrar"),
  });
}

export function useDeleteInteraction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => interactionsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: interactionsKeys.all }),
    onError: (err) => toast.error(err instanceof Error ? err.message : "No se pudo eliminar"),
  });
}
