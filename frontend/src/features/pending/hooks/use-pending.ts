import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  pendingApi,
  type AcceptBody,
  type PendingBucket,
  type RejectBody,
} from "../api/pending-api";
import { withoutProposal } from "../lib/optimistic";
import { trackAction } from "@core/telemetry/usage";

/**
 * One always-visible slice of the queue.
 *
 * `urgent` and `recent` are what the page opens on and must stay live; `old` is
 * paged behind a button (see `useOldProposals`) and is deliberately not polled.
 */
export function usePendingBucket(bucket: PendingBucket, status = "pending") {
  return useQuery({
    queryKey: ["pending", status, bucket],
    queryFn: () => pendingApi.list({ status, bucket, limit: 20 }),
    refetchInterval: 15_000,
  });
}

/** Everything with no deadline and older than a day, five at a time. */
export function useOldProposals(enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ["pending", "pending", "old"],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      pendingApi.list({ status: "pending", bucket: "old", limit: OLD_PAGE, offset: pageParam }),
    getNextPageParam: (last, all) => (last.length === OLD_PAGE ? all.length * OLD_PAGE : undefined),
    // Nothing is fetched until the broker asks: not paying for the backlog is
    // the whole point of hiding it.
    enabled,
  });
}

/** A decided proposal — accepted or rejected — newest decision first. */
export function useDecidedProposals(status: "accepted" | "rejected") {
  return useInfiniteQuery({
    queryKey: ["pending", status],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => pendingApi.list({ status, limit: 20, offset: pageParam }),
    getNextPageParam: (last, all) => (last.length === 20 ? all.length * 20 : undefined),
  });
}

/** How many are waiting, uncapped.
 *
 * This used to be `list().length`, which was honest only while the list was
 * unbounded. With a page size that silently becomes "at most 20" — a badge that
 * stops counting is worse than no badge. */
export function usePendingCount() {
  const q = useQuery({
    queryKey: ["pending", "count"],
    queryFn: () => pendingApi.count(),
    refetchInterval: 30_000,
  });
  return q.data?.pending ?? 0;
}

/** Five at a time: the backlog is reviewed, not scrolled. */
const OLD_PAGE = 5;

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
    // On success, not onSettled: the mutation is optimistic, so onSettled also
    // runs after a rollback and would count a failed accept as a use of Propo.
    onSuccess: () => trackAction("propuesta_aceptada"),
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

/**
 * Undo an accepted proposal. Destructive — it removes the record the accept
 * created, or restores the one it modified — so no optimistic move: the row is
 * shifting between tabs and the server decides whether it may.
 */
export function useUndoProposal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => pendingApi.undo(id),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["pending"] });
      queryClient.invalidateQueries({ queryKey: ["analytics", "pending-count"] });
    },
  });
}

/** Put a rejected proposal back in the queue. */
export function useReopenProposal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => pendingApi.reopen(id),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["pending"] });
      queryClient.invalidateQueries({ queryKey: ["analytics", "pending-count"] });
    },
  });
}
