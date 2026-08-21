import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { editByPrefix, patchById, rollbackAll } from "@shared/lib/optimistic";
import { opportunitiesApi, type ListOpportunitiesParams } from "../api/opportunities-api";
import type { OpportunityInput } from "../types";

export const opportunitiesKeys = {
  all: ["opportunities"] as const,
  list: (params: ListOpportunitiesParams) => ["opportunities", "list", params] as const,
};

export function useOpportunities(params: ListOpportunitiesParams = {}) {
  return useQuery({
    queryKey: opportunitiesKeys.list(params),
    queryFn: () => opportunitiesApi.list(params),
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

export function useCreateOpportunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: OpportunityInput) => opportunitiesApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: opportunitiesKeys.all }),
    onError: (err) => toast.error(err instanceof Error ? err.message : "No se pudo crear"),
  });
}

export function useUpdateOpportunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<OpportunityInput> }) =>
      opportunitiesApi.update(id, body),
    // The kanban drag is the case that made this necessary: the card snapped
    // back to its old column and jumped to the new one a second later, which
    // reads as the app fighting the gesture.
    onMutate: async ({ id, body }) => {
      await qc.cancelQueries({ queryKey: opportunitiesKeys.all });
      return {
        snapshots: editByPrefix(qc, opportunitiesKeys.all, (d: unknown) => patchById(d, id, body)),
      };
    },
    onError: (err, _vars, ctx) => {
      rollbackAll(qc, ctx?.snapshots);
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: opportunitiesKeys.all }),
  });
}
