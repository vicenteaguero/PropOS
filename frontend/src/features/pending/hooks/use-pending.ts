import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { pendingApi, type AcceptBody, type RejectBody } from "../api/pending-api";
import { withoutProposal } from "../lib/optimistic";

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

function optimisticRemoveById(qc: ReturnType<typeof useQueryClient>, id: string) {
  const snapshots: Array<{ key: readonly unknown[]; data: unknown }> = [];
  const queries = qc.getQueriesData({ queryKey: ["pending"] });
  for (const [key, data] of queries) {
    if (data === undefined) continue;
    snapshots.push({ key, data });
    qc.setQueryData(key, withoutProposal(data, id));
  }
  return snapshots;
}

export function useAcceptProposal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body?: AcceptBody }) =>
      pendingApi.accept(id, body || {}),
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: ["pending"] });
      return { snapshots: optimisticRemoveById(queryClient, id) };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshots.forEach(({ key, data }) => {
        if (data) queryClient.setQueryData(key, data);
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["pending"] });
      queryClient.invalidateQueries({ queryKey: ["analytics", "pending-count"] });
    },
  });
}

export function useRejectProposal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body?: RejectBody }) =>
      pendingApi.reject(id, body ?? {}),
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: ["pending"] });
      return { snapshots: optimisticRemoveById(queryClient, id) };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshots.forEach(({ key, data }) => {
        if (data) queryClient.setQueryData(key, data);
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["pending"] });
      queryClient.invalidateQueries({ queryKey: ["analytics", "pending-count"] });
    },
  });
}
