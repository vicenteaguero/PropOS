import { describe, expect, it } from "vitest";
import { UPCOMING_PAGE_DAYS, upcomingDays, upcomingWindow } from "./upcoming";
import { dayKey } from "./calendar-range";
import type { CalendarItem } from "../api/calendar-api";

const TODAY = new Date("2026-09-01T10:00:00");
const item = (iso: string): CalendarItem =>
  ({ id: iso, item_type: "EVENT", start_at: iso, tenant_id: "t" }) as CalendarItem;

const mapOf = (isos: string[]) => {
  const m = new Map<string, CalendarItem[]>();
  for (const iso of isos) {
    const key = dayKey(new Date(iso));
    m.set(key, [...(m.get(key) ?? []), item(iso)]);
  }
  return m;
};

describe("upcomingWindow", () => {
  it("starts today and covers today plus six", () => {
    const { from, to } = upcomingWindow(UPCOMING_PAGE_DAYS, TODAY);
    expect(dayKey(from)).toBe("2026-09-01");
    expect(dayKey(to)).toBe("2026-09-08");
  });

  it("widens with each page, so the REQUEST grows and not just the render", () => {
    // This is the whole point: paginating a list that already holds every
    // event a tenant has saves nothing — the cost was the fetch.
    expect(dayKey(upcomingWindow(14, TODAY).to)).toBe("2026-09-15");
    expect(dayKey(upcomingWindow(21, TODAY).to)).toBe("2026-09-22");
  });

  it("never asks for less than one page", () => {
    expect(dayKey(upcomingWindow(0, TODAY).to)).toBe("2026-09-08");
  });
});

describe("upcomingDays", () => {
  const items = mapOf([
    "2026-09-01T09:00:00",
    "2026-09-03T09:00:00",
    "2026-09-12T09:00:00",
    "2026-08-30T09:00:00",
  ]);

  it("lists only the days inside the window that have something on them", () => {
    expect(upcomingDays(items, UPCOMING_PAGE_DAYS, TODAY).map(dayKey)).toEqual([
      "2026-09-01",
      "2026-09-03",
    ]);
  });

  it("never looks backwards — yesterday is not upcoming", () => {
    expect(upcomingDays(items, UPCOMING_PAGE_DAYS, TODAY).map(dayKey)).not.toContain("2026-08-30");
  });

  it("reaches the next page's days once the window widens", () => {
    expect(upcomingDays(items, 14, TODAY).map(dayKey)).toContain("2026-09-12");
  });
});
