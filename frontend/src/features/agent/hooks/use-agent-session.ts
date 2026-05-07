import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { agentApi } from "../api/agent-api";

export function useAgentSession(opts?: { forceNew?: boolean }) {
  return useQuery({
    queryKey: ["agent", "session", { forceNew: !!opts?.forceNew }],
    queryFn: () => agentApi.createOrResumeSession({ forceNew: opts?.forceNew }),
    staleTime: opts?.forceNew ? 0 : 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

export function useAgentSessionList() {
  return useQuery({
    queryKey: ["agent", "sessions"],
    queryFn: () => agentApi.listSessions(),
    staleTime: 30_000,
  });
}

export function useAgentMessages(sessionId: string | undefined) {
  return useQuery({
    queryKey: ["agent", "messages", sessionId],
    queryFn: () => agentApi.listMessages(sessionId!),
    enabled: !!sessionId,
    staleTime: 0,
  });
}

export function useStartFreshSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => agentApi.createOrResumeSession({ forceNew: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent", "sessions"] });
    },
  });
}
