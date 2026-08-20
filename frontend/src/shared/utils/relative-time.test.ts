import { describe, expect, it } from "vitest";
import { listTime, timeAgo } from "./relative-time";

const NOW = new Date("2026-08-20T15:00:00-04:00");
const at = (iso: string) => listTime(iso, NOW);

describe("listTime", () => {
  it("shows a clock time for today", () => {
    expect(at("2026-08-20T09:30:00-04:00")).toMatch(/9:30/);
  });

  it("says Ayer rather than a date", () => {
    expect(at("2026-08-19T23:00:00-04:00")).toBe("Ayer");
  });

  it("names the weekday inside the last week", () => {
    // 2026-08-17 is a Monday.
    expect(at("2026-08-17T10:00:00-04:00")).toBe("Lunes");
  });

  it("falls back to a date once a week has passed", () => {
    expect(at("2026-08-04T10:00:00-04:00")).toMatch(/ago/);
  });

  it("adds the year for anything older than this one", () => {
    expect(at("2025-11-04T10:00:00-04:00")).toMatch(/2025/);
  });

  it("returns an empty string rather than throwing on bad input", () => {
    for (const bad of [null, undefined, "", "no-soy-una-fecha"]) {
      expect(listTime(bad, NOW)).toBe("");
    }
  });
});

describe("timeAgo", () => {
  it("counts in the largest unit that still reads naturally", () => {
    expect(timeAgo("2026-08-20T14:56:00-04:00", NOW)).toBe("Hace 4 min");
    expect(timeAgo("2026-08-20T11:00:00-04:00", NOW)).toBe("Hace 4 h");
    expect(timeAgo("2026-08-17T15:00:00-04:00", NOW)).toBe("Hace 3 d");
    expect(timeAgo("2026-06-20T15:00:00-04:00", NOW)).toBe("Hace 2 meses");
  });

  it("says Recién instead of 0 min", () => {
    expect(timeAgo("2026-08-20T14:59:45-04:00", NOW)).toBe("Recién");
  });
});
