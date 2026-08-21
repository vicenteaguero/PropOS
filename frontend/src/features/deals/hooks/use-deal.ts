import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { dealsApi } from "../api/deals-api";

export const dealKeys = {
  detail: (id: string) => ["deals", "detail", id] as const,
};

export function useDeal(id: string | undefined) {
  return useQuery({
    queryKey: dealKeys.detail(id ?? ""),
    queryFn: () => dealsApi.detail(id as string),
    enabled: !!id,
    staleTime: 30_000,
  });
}

/**
 * Move the deal a stage.
 *
 * The server decides whether the move is legal — `pipeline_transitions`
 * declares which ones exist and which need a person — so a refusal comes back
 * as a 409 with a Spanish sentence, and that sentence is what the broker sees.
 */
export function useSetDealStage(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (stage: string) => dealsApi.setStage(id, stage),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: dealKeys.detail(id) });
      void qc.invalidateQueries({ queryKey: ["opportunities"] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "No se pudo mover el negocio"),
  });
}
