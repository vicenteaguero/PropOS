import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  Clock,
  ListTodo,
  MapPin,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { format } from "date-fns";
import type { PillTone } from "@shared/ui";
import type { CalendarItem, EventKind } from "../api/calendar-api";

/** Per-type tone + dot color + kind icon (semantic tokens only). */
export const TYPE_META: Record<
  CalendarItem["item_type"],
  { tone: PillTone; dot: string; label: string; icon: LucideIcon }
> = {
  EVENT: { tone: "accent", dot: "var(--color-accent-brand)", label: "Evento", icon: MapPin },
  TASK: { tone: "warning", dot: "var(--color-warning)", label: "Tarea", icon: ListTodo },
  PAYMENT: { tone: "success", dot: "var(--color-success)", label: "Pago", icon: Banknote },
};

export const KIND_ITEMS: { id: EventKind; label: string }[] = [
  { id: "VISIT", label: "Visita" },
  { id: "MEETING", label: "Reunión" },
  { id: "CALL", label: "Llamada" },
  { id: "DEADLINE", label: "Vencimiento" },
  { id: "OTHER", label: "Otro" },
];

export function asKind(value: string | null | undefined): EventKind {
  return KIND_ITEMS.find((k) => k.id === value)?.id ?? "OTHER";
}

export function kindLabel(value: string | null | undefined): string {
  return KIND_ITEMS.find((k) => k.id === value)?.label ?? "Otro";
}

export function timeLabel(it: CalendarItem): string {
  if (it.all_day || !it.start_at) return "Todo";
  return format(new Date(it.start_at), "HH:mm");
}

export function durationLabel(it: CalendarItem): string {
  if (it.all_day || !it.start_at) return "el día";
  if (!it.end_at) return "1h";
  const minutes = Math.round(
    (new Date(it.end_at).getTime() - new Date(it.start_at).getTime()) / 60000,
  );
  if (minutes <= 0) return "1h";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${h}h ${rest}` : `${h}h`;
}

/**
 * The status glyph for a row, or nothing.
 *
 * Only states worth interrupting for get an icon. A scheduled event and an open
 * task are what everything on a calendar is by default, and marking the default
 * marks every row — which is how the old text status line ended up costing a
 * whole line per item to say "Programado".
 */
export function statusIcon(it: CalendarItem, now = new Date()): LucideIcon | null {
  const status = (it.status ?? "").toUpperCase();
  if (status === "DONE") return CheckCircle2;
  if (status === "CANCELLED") return XCircle;
  if (it.item_type === "TASK" && it.start_at && new Date(it.start_at) < now) return AlertCircle;
  if (it.item_type === "PAYMENT" && status === "PENDING") return Clock;
  return null;
}

export type CalFilter = "all" | "EVENT" | "TASK" | "PAYMENT";

export const FILTER_ITEMS: { id: CalFilter; label: string; param: string | null }[] = [
  { id: "all", label: "Todo", param: null },
  { id: "EVENT", label: "Visitas", param: "visitas" },
  { id: "TASK", label: "Tareas", param: "tareas" },
  { id: "PAYMENT", label: "Pagos", param: "pagos" },
];

export function filterFromParam(value: string | null): CalFilter {
  return FILTER_ITEMS.find((f) => f.param === value)?.id ?? "all";
}

export function paramForFilter(filter: CalFilter): string | null {
  return FILTER_ITEMS.find((f) => f.id === filter)?.param ?? null;
}

export function matchesFilter(it: CalendarItem, filter: CalFilter): boolean {
  return filter === "all" || it.item_type === filter;
}

/** A visit today, close enough that getting there is the next thing you do. */
export function isImminentVisit(it: CalendarItem, withinHours = 3, now = new Date()): boolean {
  if (it.item_type !== "EVENT" || !it.start_at || !it.location) return false;
  if ((it.status ?? "").toUpperCase() === "CANCELLED") return false;
  const start = new Date(it.start_at);
  const diffHours = (start.getTime() - now.getTime()) / 3_600_000;
  return diffHours >= -1 && diffHours <= withinHours;
}
