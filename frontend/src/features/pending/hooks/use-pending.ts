import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { pendingApi, type AcceptBody } from "../api/pending-api";

export function usePendingProposals(status: string = "pending") {
  return useQuery({
    queryKey: ["pending", status],
    queryFn: () => pendingApi.list(status),
    refetchInterval: 15_000,
  });
}

export function usePendingCount() {
  const q = usePendingProposals("pending");
  return q.data?.length ?? 0;
}

export function useAcceptProposal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body?: AcceptBody }) =>
      pendingApi.accept(id, body || {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending"] });
    },
  });
}

export function useRejectProposal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      pendingApi.reject(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending"] });
    },
  });
}
