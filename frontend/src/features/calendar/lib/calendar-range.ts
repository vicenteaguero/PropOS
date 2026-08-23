import {
  addDays,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";

/** Monday-first, everywhere. Chile reads a week that starts on Monday. */
export const WEEK_OPTS = { weekStartsOn: 1 } as const;

export const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

export function weekOf(d: Date): Date {
  return startOfWeek(d, WEEK_OPTS);
}

export function weekDaysOf(d: Date): Date[] {
  const start = weekOf(d);
  return eachDayOfInterval({ start, end: endOfWeek(d, WEEK_OPTS) });
}

export function monthGridDays(d: Date): Date[] {
  return eachDayOfInterval({
    start: startOfWeek(startOfMonth(d), WEEK_OPTS),
    end: endOfWeek(endOfMonth(d), WEEK_OPTS),
  });
}

export function dayKey(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

/**
 * The window to fetch for a given anchor and view.
 *
 * Day and week both fetch three whole weeks — the span the day carousel can
 * reach without a new request — and both start on a Monday. That second part is
 * what matters for caching: because the range is quantised to the week, moving
 * from Tuesday to Thursday produces an identical query key instead of a new one
 * per day, which is what made every tap refetch the feed.
 */
export function feedRange(
  anchor: Date,
  view: "day" | "week" | "month",
): { start: Date; end: Date } {
  if (view === "month") {
    const days = monthGridDays(anchor);
    return { start: days[0]!, end: addDays(days[days.length - 1]!, 1) };
  }
  const current = weekOf(anchor);
  return { start: addWeeks(current, -1), end: addWeeks(current, 2) };
}

/** "Hoy" · "Mañana" · "Lunes, 17 de agosto" — one line, never the day twice. */
export function dayHeading(day: Date, today = new Date()): string {
  if (isSameDay(day, today)) return "Hoy";
  if (isSameDay(day, addDays(today, 1))) return "Mañana";
  const label = format(day, "EEEE, d 'de' MMMM", { locale: es });
  return label.charAt(0).toLocaleUpperCase("es") + label.slice(1);
}

/** The heading with the date always spelled out, for the week list. */
export function dayHeadingWithDate(day: Date, today = new Date()): string {
  const date = format(day, "d 'de' MMMM", { locale: es });
  if (isSameDay(day, today)) return `Hoy, ${date}`;
  if (isSameDay(day, addDays(today, 1))) return `Mañana, ${date}`;
  return dayHeading(day, today);
}

export function monthLabel(d: Date): string {
  const label = format(d, "MMMM yyyy", { locale: es });
  return label.charAt(0).toLocaleUpperCase("es") + label.slice(1);
}
