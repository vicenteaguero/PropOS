import { describe, expect, it } from "vitest";
import {
  deadlineTone,
  dueText,
  listTime,
  timeAgo,
  timeAgoInline,
  timeLeft,
  whenLabel,
} from "./relative-time";

// UTC throughout: the suite runs with TZ=UTC (see package.json), so anchoring
// the fixtures to a Chilean offset moved them across day boundaries.
const NOW = new Date("2026-08-20T15:00:00Z");
const at = (iso: string) => listTime(iso, NOW);

describe("listTime", () => {
  it("counts minutes for the last hour", () => {
    // A row that says "14:05" makes you subtract; "55 min" is the answer.
    expect(at("2026-08-20T14:05:00Z")).toBe("55 min");
    expect(at("2026-08-20T14:59:45Z")).toBe("Recién");
  });

  it("counts hours up to six, then switches to the clock", () => {
    // Chile writes 06:47, not "6:47 a. m." — and the list column is six
    // characters wide, so the meridiem was both wrong and the widest part.
    expect(at("2026-08-20T11:00:00Z")).toBe("4 h");
    expect(at("2026-08-20T06:00:00Z")).toBe("06:00");
  });

  it("says Ayer rather than a date", () => {
    expect(at("2026-08-19T23:00:00Z")).toBe("Ayer");
  });

  it("abbreviates the weekday inside the last week", () => {
    // 2026-08-17 is a Monday.
    expect(at("2026-08-17T10:00:00Z")).toBe("Lun");
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

describe("whenLabel", () => {
  const w = (iso: string) => whenLabel(iso, NOW);

  it("walks the ladder from minutes to a full date", () => {
    expect(w("2026-08-20T14:59:45Z")).toBe("Recién");
    expect(w("2026-08-20T14:48:00Z")).toBe("Hace 12 minutos");
    expect(w("2026-08-20T14:00:00Z")).toBe("Hace 1 hora");
    expect(w("2026-08-20T09:00:00Z")).toBe("Hace 6 horas");
    expect(w("2026-08-20T06:00:00Z")).toBe("Hoy a las 06:00");
    expect(w("2026-08-19T15:45:00Z")).toBe("Ayer a las 15:45");
    expect(w("2026-08-17T15:45:00Z")).toBe("Lunes a las 15:45");
    expect(w("2026-08-04T10:00:00Z")).toBe("4 ago");
    expect(w("2025-07-19T10:00:00Z")).toMatch(/2025/);
  });

  it("never calls today by its weekday", () => {
    // The bug that started this: a conversation from this morning read
    // "Domingo" while you were looking at it on a Sunday.
    const sunday = new Date("2026-08-23T20:00:00Z");
    expect(whenLabel("2026-08-23T08:00:00Z", sunday)).toBe("Hoy a las 08:00");
  });

  it("reads a future instant as a time, not as elapsed time", () => {
    expect(w("2026-08-20T18:30:00Z")).toBe("Hoy a las 18:30");
    expect(w("2026-08-22T09:00:00Z")).toBe("Sábado a las 09:00");
  });

  it("returns an empty string rather than throwing on bad input", () => {
    for (const bad of [null, undefined, "", "no-soy-una-fecha"]) {
      expect(whenLabel(bad, NOW)).toBe("");
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

describe("timeLeft", () => {
  const NOW = new Date("2026-08-21T12:00:00Z");
  const left = (iso: string) => timeLeft(iso, NOW);

  it("counts the last hour in minutes", () => {
    expect(left("2026-08-21T12:45:00Z")).toBe("Vence en 45 min");
  });

  it("counts hours inside the day", () => {
    expect(left("2026-08-21T18:00:00Z")).toBe("Vence en 6 h");
  });

  it("says Vencida rather than a negative number", () => {
    // A passed deadline still matters — the proposal is still actionable in the
    // CRM, just not in the channel — so it reads as a state, not an error.
    expect(left("2026-08-21T11:00:00Z")).toBe("Vencida");
  });

  it("is empty when there is no deadline at all", () => {
    // A proposal from the broker's own voice note has no external clock, and
    // inventing one would be a fabricated fact.
    expect(timeLeft(null, NOW)).toBe("");
  });
});

describe("deadlineTone", () => {
  const NOW = new Date("2026-08-21T12:00:00Z");
  it("goes red inside two hours and amber inside six", () => {
    expect(deadlineTone("2026-08-21T13:00:00Z", NOW)).toBe("danger");
    expect(deadlineTone("2026-08-21T17:00:00Z", NOW)).toBe("warn");
    expect(deadlineTone("2026-08-22T12:00:00Z", NOW)).toBe("none");
    expect(deadlineTone(null, NOW)).toBe("none");
  });
});
