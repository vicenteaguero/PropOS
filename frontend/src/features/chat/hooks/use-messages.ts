import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@core/supabase/client";
import { getMessages } from "@features/chat/services/chat-api";
import type { Message } from "@features/chat/types";
import { CONVERSATIONS_QUERY_KEY } from "@features/chat/hooks/use-conversations";

export function useMessages(conversationId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["messages", conversationId] as const;

  const query = useQuery<Message[], Error>({
    queryKey,
    queryFn: () => getMessages(conversationId!),
    enabled: !!conversationId,
  });

  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const newMessage: Message = {
            id: row.id as string,
            conversationId: row.conversation_id as string,
            senderId: row.sender_id as string | null,
            content: row.content as string,
            tenantId: row.tenant_id as string,
            createdAt: row.created_at as string,
          };

          queryClient.setQueryData<Message[]>(queryKey, (old) => {
            if (!old) return [newMessage];
            if (old.some((m) => m.id === newMessage.id)) return old;
            return [...old, newMessage];
          });

          // Invalidate conversations to refresh last message
          queryClient.invalidateQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient, queryKey]);

  return query;
}
