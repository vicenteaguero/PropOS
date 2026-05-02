// TODO: producción — refactor genérico OK pero tipado/contrato del payload requiere validación cuando se use en feature real.
import { useState, useEffect, useCallback } from "react";
import { subscribeToTable, unsubscribeFromChannel } from "@core/supabase/realtime";
import { createLogger } from "@core/logging/logger";

const logger = createLogger("UseRealtime");

export function useRealtime<T extends Record<string, unknown>>(
  table: string,
  initialData: T[] = [],
): T[] {
  const [data, setData] = useState<T[]>(initialData);

  const handlePayload = useCallback(
    (payload: { eventType: string; new: T; old: T }) => {
      logger.info("data", `Realtime event on ${table}`, { event: payload.eventType });

      setData((current) => {
        switch (payload.eventType) {
          case "INSERT":
            return [...current, payload.new];
          case "UPDATE":
            return current.map((item) =>
              (item as Record<string, unknown>)["id"] ===
              (payload.new as Record<string, unknown>)["id"]
                ? payload.new
                : item,
            );
          case "DELETE":
            return current.filter(
              (item) =>
                (item as Record<string, unknown>)["id"] !==
                (payload.old as Record<string, unknown>)["id"],
            );
          default:
            return current;
        }
      });
    },
    [table],
  );

  useEffect(() => {
    const channel = subscribeToTable<T>(table, handlePayload);

    return () => {
      unsubscribeFromChannel(channel);
    };
  }, [table, handlePayload]);

  return data;
}
