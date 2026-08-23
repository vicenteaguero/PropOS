import { describe, expect, it } from "vitest";
import { placeOverlapping } from "./overlap";
import type { CalendarItem } from "../api/calendar-api";

function ev(id: string, start: string, end?: string): CalendarItem {
  return {
    tenant_id: "t",
    item_type: "EVENT",
    id,
    title: id,
    start_at: `2026-08-22T${start}:00Z`,
    end_at: end ? `2026-08-22T${end}:00Z` : null,
    all_day: false,
    status: "SCHEDULED",
    kind: "VISIT",
    property_id: null,
    contact_id: null,
    amount_cents: null,
  } as CalendarItem;
}

const byId = (placed: ReturnType<typeof placeOverlapping>) =>
  Object.fromEntries(placed.map((p) => [p.item.id, { column: p.column, columns: p.columns }]));

describe("placeOverlapping", () => {
  it("gives a lone event the full width", () => {
    expect(byId(placeOverlapping([ev("a", "09:00", "10:00")]))).toEqual({
      a: { column: 0, columns: 1 },
    });
  });

  it("splits two overlapping events into two columns", () => {
    const got = byId(placeOverlapping([ev("a", "09:00", "10:00"), ev("b", "09:30", "10:30")]));
    expect(got.a).toEqual({ column: 0, columns: 2 });
    expect(got.b).toEqual({ column: 1, columns: 2 });
  });

  it("keeps sequential events full width", () => {
    // They touch but do not overlap, so neither should be squeezed.
    const got = byId(placeOverlapping([ev("a", "09:00", "10:00"), ev("b", "10:00", "11:00")]));
    expect(got.a).toEqual({ column: 0, columns: 1 });
    expect(got.b).toEqual({ column: 0, columns: 1 });
  });

  it("reuses a column once the earlier event has ended", () => {
    const got = byId(
      placeOverlapping([
        ev("a", "09:00", "11:00"),
        ev("b", "09:30", "10:00"),
        ev("c", "10:15", "10:45"),
      ]),
    );
    expect(got.a?.column).toBe(0);
    expect(got.b?.column).toBe(1);
    expect(got.c?.column).toBe(1);
    expect(got.a?.columns).toBe(2);
  });

  it("treats a zero-length event as a readable band", () => {
    // Without a floor these would be points and would stack invisibly.
    const got = byId(placeOverlapping([ev("a", "09:00"), ev("b", "09:10")]));
    expect(got.a?.columns).toBe(2);
  });

  it("handles an empty day", () => {
    expect(placeOverlapping([])).toEqual([]);
  });
});
