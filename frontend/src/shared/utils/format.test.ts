import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatDateTime,
  formatDayMonth,
  formatShortDateTime,
  initials,
} from "./format";

describe("initials", () => {
  it("takes the first letter of the first two words", () => {
    expect(initials("Vicente Agüero")).toBe("VA");
    expect(initials("Ana María Pérez Soto")).toBe("AM");
  });

  it("handles a single name", () => {
    expect(initials("Propo")).toBe("P");
  });

  it("collapses extra whitespace instead of emitting blanks", () => {
    // The old copies split on a literal " ", so "Ana  María" produced "A" + ""
    // and rendered a single letter.
    expect(initials("Ana  María")).toBe("AM");
    expect(initials("  Vicente  ")).toBe("V");
  });

  it("returns ? for missing names rather than throwing or rendering empty", () => {
    expect(initials(null)).toBe("?");
    expect(initials(undefined)).toBe("?");
    expect(initials("")).toBe("?");
    expect(initials("   ")).toBe("?");
  });
});

describe("date formatters", () => {
  const iso = "2026-08-12T14:30:00.000Z";

  it("formats a timestamp in each style", () => {
    // es-CL renders `medium` as 12-08-2026 and `short` as 12-08-26, so the
    // styles differ by year width, not by month name.
    expect(formatDateTime(iso)).toMatch(/12-08-2026/);
    expect(formatDateTime(iso)).toMatch(/10:30/);
    expect(formatShortDateTime(iso)).toMatch(/12-08-26/);
    expect(formatDayMonth(iso)).toBe("12 ago");
    expect(formatDate(iso)).toBe("12-08-2026");
  });

  it("returns the fallback for null, undefined and empty input", () => {
    for (const fn of [formatDateTime, formatShortDateTime, formatDayMonth, formatDate]) {
      expect(fn(null)).toBe("");
      expect(fn(undefined)).toBe("");
      expect(fn("")).toBe("");
      expect(fn(null, "—")).toBe("—");
    }
  });

  it("returns the fallback for an unparseable date instead of 'Invalid Date'", () => {
    expect(formatDateTime("not-a-date")).toBe("");
    expect(formatDateTime("not-a-date", "—")).toBe("—");
  });
});
