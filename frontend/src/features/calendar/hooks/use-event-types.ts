import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { asCategoryColor, type CategoryColor } from "@shared/ui/category-palette";
import {
  calendarApi,
  type EventBehavior,
  type EventType,
  type EventTypeInput,
} from "../api/calendar-api";

/**
 * The tenant's event catalog, with the five system types as the floor.
 *
 * Never returns an empty list. A calendar with no types renders a blank Tipo
 * select and colourless rows, and "the catalog has not loaded yet" and "this
 * tenant has no types" look identical on screen — so the seeded five stand in
 * until the request lands.
 */
const SEEDED: { key: string; label: string; color: string; behavior: EventBehavior }[] = [
  { key: "VISIT", label: "Visita", color: "violet", behavior: "visit" },
  { key: "MEETING", label: "Reunión", color: "sky", behavior: "meeting" },
  { key: "CALL", label: "Llamada", color: "teal", behavior: "call" },
  { key: "DEADLINE", label: "Vencimiento", color: "amber", behavior: "deadline" },
  { key: "OTHER", label: "Otro", color: "slate", behavior: "other" },
];

const FALLBACK: EventType[] = SEEDED.map((t, position) => ({
  ...t,
  id: t.key,
  tenant_id: "",
  icon: null,
  position,
  active: true,
  is_system: true,
}));

export interface ResolvedEventType {
  key: string;
  label: string;
  color: CategoryColor;
  behavior: EventBehavior;
}

export function useEventTypes() {
  const query = useQuery({
    queryKey: ["calendar", "types"],
    queryFn: calendarApi.types,
    // A catalog changes about once a quarter; refetching it per calendar view
    // would be one request per swipe.
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });

  const types = query.data?.length ? query.data : FALLBACK;

  const byKey = useMemo(() => {
    const map = new Map<string, ResolvedEventType>();
    for (const t of types) {
      map.set(t.key, {
        key: t.key,
        label: t.label,
        color: asCategoryColor(t.color),
        behavior: t.behavior,
      });
    }
    return map;
  }, [types]);

  /**
   * Never null. An event whose type was deleted still has to render, and
   * rendering it as a blank chip is how a row becomes unreadable.
   */
  const resolve = useMemo(
    () =>
      (key: string | null | undefined): ResolvedEventType =>
        byKey.get(key ?? "") ?? {
          key: key ?? "OTHER",
          label: key ? key.charAt(0) + key.slice(1).toLowerCase() : "Otro",
          color: "slate" as CategoryColor,
          behavior: "other" as EventBehavior,
        },
    [byKey],
  );

  return { types, byKey, resolve, isPending: query.isPending };
}

/** Every type including the deactivated ones — the Configuración screen. */
export function useAllEventTypes(enabled = true) {
  return useQuery({
    queryKey: ["calendar", "types", "all"],
    queryFn: calendarApi.allTypes,
    enabled,
    staleTime: 60_000,
  });
}

export function useEventTypeMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["calendar", "types"] });
  const fail = (fallback: string) => (err: unknown) =>
    toast.error(err instanceof Error ? err.message : fallback);

  return {
    create: useMutation({
      mutationFn: (body: EventTypeInput) => calendarApi.createType(body),
      onSuccess: invalidate,
      onError: fail("No se pudo crear el tipo"),
    }),
    update: useMutation({
      mutationFn: ({ id, body }: { id: string; body: Partial<Omit<EventTypeInput, "key">> }) =>
        calendarApi.updateType(id, body),
      onSuccess: invalidate,
      onError: fail("No se pudo guardar el tipo"),
    }),
    remove: useMutation({
      mutationFn: (id: string) => calendarApi.deleteType(id),
      onSuccess: invalidate,
      onError: fail("No se pudo eliminar el tipo"),
    }),
  };
}
