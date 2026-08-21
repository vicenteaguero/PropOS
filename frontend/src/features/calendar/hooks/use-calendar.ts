import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { editByPrefix, patchById, rollbackAll } from "@shared/lib/optimistic";
import { calendarApi, type EventInput, type EventPatch } from "../api/calendar-api";

export function useCalendarFeed(from: string, to: string) {
  return useQuery({
    queryKey: ["calendar", "feed", from, to],
    queryFn: () => calendarApi.feed(from, to),
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

/** Full event row. The feed item lacks location/description, so edit needs this. */
export function useEvent(id: string | undefined) {
  return useQuery({
    queryKey: ["calendar", "event", id ?? ""],
    queryFn: () => calendarApi.getEvent(id as string),
    enabled: !!id,
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

export function useUpdateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: EventPatch }) =>
      calendarApi.updateEvent(id, body),
    // The "calendar" prefix covers both the feed and the single-event cache.
    // Rescheduling is a drag, so the block has to move under the finger rather
    // than a round trip later.
    onMutate: async ({ id, body }) => {
      await qc.cancelQueries({ queryKey: ["calendar"] });
      return { snapshots: editByPrefix(qc, ["calendar"], (d: unknown) => patchById(d, id, body)) };
    },
    onError: (err, _vars, ctx) => {
      rollbackAll(qc, ctx?.snapshots);
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar el evento");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["calendar"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useDeleteEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => calendarApi.deleteEvent(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calendar"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar el evento"),
  });
}
