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
import { categoryVars, type CategoryColor } from "@shared/ui/category-palette";
import type { CalendarItem } from "../api/calendar-api";

/**
 * What a calendar row is, and what colour it takes.
 *
 * The three sources are fixed; an EVENT's colour and label come from the
 * tenant's type catalog, so "Tasación" is as first-class as "Visita".
 *
 * The old version of this gave EVENT `--accent-brand` — the workspace hue —
 * which meant that for some tenants an event was the same colour as a payment
 * and the legend became three identical dots. Every colour here is a member of
 * the fixed categorical palette instead.
 */
export interface ItemMeta {
  color: CategoryColor;
  label: string;
  icon: LucideIcon;
  /** CSS values, ready for a style prop. */
  ink: string;
  wash: string;
  edge: string;
}

const SOURCE_META: Record<
  CalendarItem["item_type"],
  { color: CategoryColor; label: string; icon: LucideIcon }
> = {
  // The legend colour for "every event type at once". An individual event
  // takes its own type's colour instead — this is the filter, not the row.
  EVENT: { color: "indigo", label: "Evento", icon: MapPin },
  TASK: { color: "amber", label: "Tarea", icon: ListTodo },
  PAYMENT: { color: "lime", label: "Pago", icon: Banknote },
};

/** The kind→type resolver from `useEventTypes()`. */
export type TypeResolver = (key: string | null | undefined) => {
  key: string;
  label: string;
  color: CategoryColor;
};

export function itemMeta(it: CalendarItem, resolve?: TypeResolver): ItemMeta {
  const base = SOURCE_META[it.item_type];
  const type = it.item_type === "EVENT" && resolve ? resolve(it.kind) : null;
  const color = type?.color ?? base.color;
  return {
    color,
    label: type?.label ?? base.label,
    icon: base.icon,
    ...categoryVars(color),
  };
}

/** The colour of a source with no event type in play — legends, filter chips. */
export function sourceMeta(type: CalendarItem["item_type"]): ItemMeta {
  const base = SOURCE_META[type];
  return { ...base, ...categoryVars(base.color) };
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
  // The URL param stays `visitas` so saved links keep working; the label
  // does not, because the filter has always matched every event type and
  // calling it "Visitas" hid meetings and calls behind a word for one of them.
  { id: "EVENT", label: "Eventos", param: "visitas" },
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
