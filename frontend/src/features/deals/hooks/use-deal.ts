import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { editByPrefix, patchById, rollbackAll } from "@shared/lib/optimistic";
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
    // Optimistic, and the rollback matters more here than anywhere else: the
    // server can legitimately refuse the move, so the card can travel and come
    // back. Without the toast that return trip looks like the app losing the
    // gesture rather than the pipeline declining it.
    onMutate: async (stage) => {
      await qc.cancelQueries({ queryKey: ["deals"] });
      await qc.cancelQueries({ queryKey: ["opportunities"] });
      return {
        snapshots: [
          ...editByPrefix(qc, ["deals"], (d: unknown) =>
            patchById(d, id, { pipeline_stage: stage }),
          ),
          ...editByPrefix(qc, ["opportunities"], (d: unknown) =>
            patchById(d, id, { pipeline_stage: stage }),
          ),
        ],
      };
    },
    onError: (err, _stage, ctx) => {
      rollbackAll(qc, ctx?.snapshots);
      toast.error(err instanceof Error ? err.message : "No se pudo mover el negocio");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: dealKeys.detail(id) });
      void qc.invalidateQueries({ queryKey: ["opportunities"] });
    },
  });
}
