import { useQuery } from "@tanstack/react-query";
import { listConversations } from "@features/chat/services/chat-api";
import type { Conversation } from "@features/chat/types";

export const CONVERSATIONS_QUERY_KEY = ["conversations"] as const;

export function useConversations() {
  return useQuery<Conversation[], Error>({
    queryKey: CONVERSATIONS_QUERY_KEY,
    queryFn: listConversations,
  });
}
