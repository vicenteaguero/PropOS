import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@core/supabase/client";
import { clientChatApi } from "../api/client-chat-api";
import type { ClientMessage, ConversationStatus } from "../types";

export function useConversations(status?: ConversationStatus) {
  return useQuery({
    queryKey: ["client-chat", "conversations", status ?? "all"],
    queryFn: () => clientChatApi.listConversations(status),
    refetchInterval: 20_000,
  });
}

export function useConversationMessages(conversationId: string | null) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["client-chat", "messages", conversationId],
    queryFn: () =>
      conversationId ? clientChatApi.listMessages(conversationId) : Promise.resolve([]),
    enabled: !!conversationId,
  });

  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`client_messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "client_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          qc.setQueryData<ClientMessage[]>(
            ["client-chat", "messages", conversationId],
            (prev) => {
              if (!prev) return prev;
              const incoming = payload.new as ClientMessage | null;
              if (payload.eventType === "INSERT" && incoming) {
                if (prev.some((m) => m.id === incoming.id)) return prev;
                return [...prev, incoming];
              }
              if (payload.eventType === "UPDATE" && incoming) {
                return prev.map((m) => (m.id === incoming.id ? incoming : m));
              }
              return prev;
            },
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, qc]);

  return query;
}

export function useSendMessage(conversationId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => {
      if (!conversationId) throw new Error("no conversation");
      return clientChatApi.send(conversationId, text);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-chat", "messages", conversationId] });
    },
  });
}

export function useTakeover(conversationId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (action: "take" | "release" | "close") => {
      if (!conversationId) throw new Error("no conversation");
      if (action === "take") {
        return clientChatApi.patch(conversationId, {
          status: "assigned",
          ai_enabled: false,
        });
      }
      if (action === "release") {
        return clientChatApi.patch(conversationId, {
          status: "open",
          ai_enabled: true,
        });
      }
      return clientChatApi.patch(conversationId, { status: "closed" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-chat", "conversations"] });
    },
  });
}

export function useUpsertConsent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (contactId: string) => clientChatApi.upsertConsent(contactId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-chat"] });
    },
  });
}
