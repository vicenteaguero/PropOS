import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { anitaApi } from "../api/anita-api";

export function useAnitaSession(opts?: { forceNew?: boolean }) {
  return useQuery({
    queryKey: ["anita", "session", { forceNew: !!opts?.forceNew }],
    queryFn: () => anitaApi.createOrResumeSession({ forceNew: opts?.forceNew }),
    staleTime: opts?.forceNew ? 0 : 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

export function useAnitaSessionList() {
  return useQuery({
    queryKey: ["anita", "sessions"],
    queryFn: () => anitaApi.listSessions(),
    staleTime: 30_000,
  });
}

export function useAnitaMessages(sessionId: string | undefined) {
  return useQuery({
    queryKey: ["anita", "messages", sessionId],
    queryFn: () => anitaApi.listMessages(sessionId!),
    enabled: !!sessionId,
    staleTime: 0,
  });
}

export function useStartFreshSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => anitaApi.createOrResumeSession({ forceNew: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["anita", "sessions"] });
    },
  });
}
