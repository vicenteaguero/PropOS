import { useQuery } from "@tanstack/react-query";
import { anitaApi } from "../api/anita-api";

export function useAnitaSession() {
  return useQuery({
    queryKey: ["anita", "session"],
    queryFn: () => anitaApi.createOrResumeSession(),
    staleTime: 5 * 60 * 1000,
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
