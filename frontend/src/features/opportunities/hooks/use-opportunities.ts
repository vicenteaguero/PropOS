import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
    onSuccess: () => qc.invalidateQueries({ queryKey: opportunitiesKeys.all }),
    onError: (err) => toast.error(err instanceof Error ? err.message : "No se pudo actualizar"),
  });
}
