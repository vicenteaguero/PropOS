import { addDays, startOfDay } from "date-fns";
import { dayKey } from "./calendar-range";
import type { CalendarItem } from "../api/calendar-api";

/** Days per page in the month view's upcoming list. Today plus six. */
export const UPCOMING_PAGE_DAYS = 7;

/**
 * The window the upcoming list is asking for, in days from today.
 *
 * Pulled out so the pagination is testable, because the property that matters
 * is not a render detail: each page has to widen the FEED REQUEST, not slice
 * an array that was already fetched. A month view that pulled every event a
 * tenant has in order to draw three hundred dots was the thing being fixed.
 */
export function upcomingWindow(days: number, today = new Date()): { from: Date; to: Date } {
  const from = startOfDay(today);
  return { from, to: addDays(from, Math.max(UPCOMING_PAGE_DAYS, days)) };
}

/** The days inside the window that actually have something on them. */
export function upcomingDays(
  itemsByDay: Map<string, CalendarItem[]>,
  days: number,
  today = new Date(),
): Date[] {
  const from = startOfDay(today);
  return Array.from({ length: days }, (_, i) => addDays(from, i)).filter(
    (d) => (itemsByDay.get(dayKey(d)) ?? []).length > 0,
  );
}
