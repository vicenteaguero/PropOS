import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { calendarApi, type EventInput } from "../api/calendar-api";

export function useCalendarFeed(from: string, to: string) {
  return useQuery({
    queryKey: ["calendar", "feed", from, to],
    queryFn: () => calendarApi.feed(from, to),
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: EventInput) => calendarApi.createEvent(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calendar"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "No se pudo crear el evento"),
  });
}
