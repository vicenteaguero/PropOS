import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@core/supabase/client";
import { createLogger } from "@core/logging/logger";

const logger = createLogger("Realtime");

type RealtimeEvent = "INSERT" | "UPDATE" | "DELETE";

interface RealtimePayload<T> {
  eventType: RealtimeEvent;
  new: T;
  old: T;
}

type RealtimeCallback<T> = (payload: RealtimePayload<T>) => void;

export function subscribeToTable<T extends Record<string, unknown>>(
  table: string,
  callback: RealtimeCallback<T>,
  schema: string = "public",
): RealtimeChannel {
  logger.info("start", `Subscribing to ${table}`, { schema });

  const channel = supabase
    .channel(`${schema}:${table}`)
    .on("postgres_changes", { event: "*", schema, table }, (payload) => {
      callback({
        eventType: payload.eventType as RealtimeEvent,
        new: payload.new as T,
        old: payload.old as T,
      });
    })
    .subscribe();

  return channel;
}

export function unsubscribeFromChannel(channel: RealtimeChannel): void {
  logger.info("process", "Unsubscribing from channel");
  supabase.removeChannel(channel);
}
