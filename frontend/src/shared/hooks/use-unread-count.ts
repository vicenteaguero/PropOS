import { useEffect, useState, useCallback } from "react";
import { supabase } from "@core/supabase/client";
import { useAuth } from "@shared/hooks/use-auth";

const LAST_READ_KEY = "propos-chat-last-read";

function getLastRead(): string {
  return localStorage.getItem(LAST_READ_KEY) ?? new Date(0).toISOString();
}

export function markChatAsRead() {
  localStorage.setItem(LAST_READ_KEY, new Date().toISOString());
}

export function useUnreadCount() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    if (!user) return;

    try {
      const lastRead = getLastRead();

      const { data: participations, error: pError } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", user.id);

      if (pError || !participations || participations.length === 0) {
        setCount(0);
        return;
      }

      const conversationIds = participations.map((p) => p.conversation_id);

      const { count: unread } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .in("conversation_id", conversationIds)
        .neq("sender_id", user.id)
        .gt("created_at", lastRead);

      setCount(unread ?? 0);
    } catch {
      setCount(0);
    }
  }, [user]);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("unread-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new as { sender_id: string };
          if (msg.sender_id !== user.id) {
            setCount((c) => c + 1);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return count;
}
