import { describe, expect, it } from "vitest";
import { dueText, listTime, timeAgo, timeAgoInline } from "./relative-time";

// UTC throughout: the suite runs with TZ=UTC (see package.json), so anchoring
// the fixtures to a Chilean offset moved them across day boundaries.
const NOW = new Date("2026-08-20T15:00:00Z");
const at = (iso: string) => listTime(iso, NOW);

describe("listTime", () => {
  it("shows a clock time for today", () => {
    expect(at("2026-08-20T09:30:00Z")).toMatch(/9:30/);
  });

  it("says Ayer rather than a date", () => {
    expect(at("2026-08-19T23:00:00Z")).toBe("Ayer");
  });

  it("names the weekday inside the last week", () => {
    // 2026-08-17 is a Monday.
    expect(at("2026-08-17T10:00:00Z")).toBe("Lunes");
  });

  it("falls back to a date once a week has passed", () => {
    expect(at("2026-08-04T10:00:00Z")).toMatch(/ago/);
  });

  it("adds the year for anything older than this one", () => {
    expect(at("2025-11-04T10:00:00Z")).toMatch(/2025/);
  });

  it("returns an empty string rather than throwing on bad input", () => {
    for (const bad of [null, undefined, "", "no-soy-una-fecha"]) {
      expect(listTime(bad, NOW)).toBe("");
    }
  });
});

describe("timeAgo", () => {
  it("counts in the largest unit that still reads naturally", () => {
    expect(timeAgo("2026-08-20T14:56:00Z", NOW)).toBe("Hace 4 min");
    expect(timeAgo("2026-08-20T11:00:00Z", NOW)).toBe("Hace 4 h");
    expect(timeAgo("2026-08-17T15:00:00Z", NOW)).toBe("Hace 3 d");
    expect(timeAgo("2026-06-20T15:00:00Z", NOW)).toBe("Hace 2 meses");
  });

  it("says Recién instead of 0 min", () => {
    expect(timeAgo("2026-08-20T14:59:45Z", NOW)).toBe("Recién");
  });
});

describe("timeAgoInline", () => {
  const now = new Date("2026-08-20T12:00:00Z");

  it("lowercases the leading word so it can follow other words", () => {
    expect(timeAgoInline("2026-08-20T09:00:00Z", now)).toBe("hace 3 h");
  });

  it("returns an empty string for a missing date, like timeAgo", () => {
    expect(timeAgoInline(null, now)).toBe("");
  });
});

describe("dueText", () => {
  const now = new Date("2026-08-20T12:00:00Z");

  it("points forward for a deadline that has not passed", () => {
    // `timeAgo` clamps to the past, so this used to read "Recién" — "just
    // happened" for something three days away.
    expect(dueText("2026-08-23T12:00:00Z", now)).toBe("Vence en 3 días");
    expect(dueText("2026-08-21T12:00:00Z", now)).toBe("Vence mañana");
    expect(dueText("2026-08-20T18:00:00Z", now)).toBe("Vence hoy");
  });

  it("points backward for one that has", () => {
    expect(dueText("2026-08-17T12:00:00Z", now)).toBe("Venció hace 3 días");
    expect(dueText("2026-08-19T12:00:00Z", now)).toBe("Venció ayer");
  });

  it("collapses to weeks and months rather than counting days forever", () => {
    expect(dueText("2026-09-03T12:00:00Z", now)).toBe("Vence en 2 semanas");
    expect(dueText("2026-06-20T12:00:00Z", now)).toBe("Venció hace 2 meses");
  });

  it("returns an empty string for a missing date", () => {
    expect(dueText(null, now)).toBe("");
  });
});
