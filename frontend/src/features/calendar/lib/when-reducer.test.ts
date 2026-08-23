import { describe, expect, it } from "vitest";
import {
  DEFAULT_DURATION_MIN,
  durationLabel,
  durationMinutes,
  initialWhen,
  spansDays,
  whenReducer,
  type WhenState,
} from "./when-reducer";

const at = (iso: string) => new Date(iso);
const base = (): WhenState => initialWhen(at("2026-09-01T10:00:00"), at("2026-09-01T11:30:00"));

describe("whenReducer", () => {
  it("gives a start with no end one hour", () => {
    const s = initialWhen(at("2026-09-01T10:00:00"));
    expect(durationMinutes(s)).toBe(DEFAULT_DURATION_MIN);
  });

  it("drags the end along when the start moves, keeping the duration", () => {
    const next = whenReducer(base(), { type: "pickDay", day: at("2026-09-04T00:00:00") });
    expect(next.start.toISOString()).toBe(at("2026-09-04T10:00:00").toISOString());
    expect(durationMinutes(next)).toBe(90);
  });

  it("hands the grid to the end after a start is picked", () => {
    // Otherwise the second tap on the calendar silently undoes the first.
    expect(whenReducer(base(), { type: "pickDay", day: at("2026-09-04T00:00:00") }).focus).toBe(
      "end",
    );
  });

  it("reads an end before the start as a new start", () => {
    const s = { ...base(), focus: "end" as const };
    const next = whenReducer(s, { type: "pickDay", day: at("2026-08-20T00:00:00") });
    expect(next.start.getDate()).toBe(20);
    expect(next.end > next.start).toBe(true);
  });

  it("rolls an earlier clock time to the next day instead of refusing it", () => {
    // 23:00-01:00 is a real booking; the old form answered it with a toast.
    const s = initialWhen(at("2026-09-01T23:00:00"), at("2026-09-02T00:00:00"));
    const next = whenReducer(s, { type: "setEndTime", minutes: 60 });
    expect(next.end.toISOString()).toBe(at("2026-09-02T01:00:00").toISOString());
    expect(spansDays(next)).toBe(1);
  });

  it("never lets the end reach the start", () => {
    let s = base();
    for (const action of [
      { type: "setStartTime" as const, minutes: 23 * 60 },
      { type: "setEndTime" as const, minutes: 0 },
      { type: "setDuration" as const, minutes: -100 },
      { type: "pickDay" as const, day: at("2020-01-01T00:00:00") },
    ]) {
      s = whenReducer(s, action);
      expect(s.end.getTime()).toBeGreaterThan(s.start.getTime());
    }
  });

  it("keeps the time of day when only the day changes", () => {
    const next = whenReducer(base(), { type: "pickDay", day: at("2026-12-25T00:00:00") });
    expect(next.start.getHours()).toBe(10);
  });
});

describe("durationLabel", () => {
  it("reads the way a person says it", () => {
    expect(durationLabel(base())).toBe("1 h 30");
    expect(durationLabel(initialWhen(at("2026-09-01T10:00"), at("2026-09-01T10:45")))).toBe(
      "45 min",
    );
    expect(durationLabel(initialWhen(at("2026-09-01T10:00"), at("2026-09-01T12:00")))).toBe("2 h");
    expect(durationLabel(initialWhen(at("2026-09-01T10:00"), at("2026-09-03T10:00")))).toBe(
      "2 días",
    );
  });

  it("says the obvious thing for an all-day event", () => {
    expect(durationLabel({ ...base(), allDay: true })).toBe("Todo el día");
  });
});
