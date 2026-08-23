import { addDays, addMinutes, differenceInMinutes, isSameDay, startOfDay } from "date-fns";

/**
 * When an event happens, as a state machine that cannot hold an invalid value.
 *
 * The old form was two `datetime-local` inputs side by side in `grid-cols-2`.
 * Every problem with it came from that: the control has a large intrinsic
 * minimum width, so at 360px the two overlapped and the seconds spinner was
 * cut off; and nothing tied them together, so the form's only defence against
 * `end <= start` was a toast after you pressed Crear.
 *
 * Here the pair moves together. Picking a start drags the end along, keeping
 * the duration you had. Picking an end before the start is read as "you meant
 * that as the new start" rather than refused. A time earlier than the start on
 * the same day rolls to the next day instead of being rejected — booking
 * 23:00-01:00 is a real thing brokers do, and no error message helps there.
 *
 * Pure and free of React so the rules can be tested without a DOM.
 */
export interface WhenState {
  start: Date;
  end: Date;
  allDay: boolean;
  /** Which half the calendar grid is currently editing. */
  focus: "start" | "end";
}

export type WhenAction =
  | { type: "pickDay"; day: Date }
  | { type: "setStartTime"; minutes: number }
  | { type: "setEndTime"; minutes: number }
  | { type: "setDuration"; minutes: number }
  | { type: "toggleAllDay" }
  | { type: "focus"; on: "start" | "end" };

export const DEFAULT_DURATION_MIN = 60;

const minutesOf = (d: Date) => d.getHours() * 60 + d.getMinutes();

const withMinutes = (day: Date, minutes: number) => {
  const next = startOfDay(day);
  next.setMinutes(minutes);
  return next;
};

/** A start with no end yet: one hour, the length of nearly every showing. */
export function initialWhen(start: Date, end?: Date | null, allDay = false): WhenState {
  const s = new Date(start);
  const e = end ? new Date(end) : addMinutes(s, DEFAULT_DURATION_MIN);
  return {
    start: s,
    end: e > s ? e : addMinutes(s, DEFAULT_DURATION_MIN),
    allDay,
    focus: "start",
  };
}

export function durationMinutes(state: WhenState): number {
  return Math.max(0, differenceInMinutes(state.end, state.start));
}

export function whenReducer(state: WhenState, action: WhenAction): WhenState {
  switch (action.type) {
    case "focus":
      return { ...state, focus: action.on };

    case "toggleAllDay":
      return { ...state, allDay: !state.allDay };

    case "pickDay": {
      if (state.focus === "start") {
        // Move the whole event, keeping its length. Someone rescheduling a
        // visit from Tuesday to Thursday is not also changing how long it is,
        // and making them re-enter the end time is how the two drift apart.
        const kept = durationMinutes(state);
        const start = withMinutes(action.day, minutesOf(state.start));
        return {
          ...state,
          start,
          end: addMinutes(start, kept || DEFAULT_DURATION_MIN),
          // Hand the grid to the end: the next thing a person does after
          // choosing a day is say how long, and a picker that stays on the
          // start makes the second tap undo the first.
          focus: "end",
        };
      }
      const end = withMinutes(action.day, minutesOf(state.end));
      // An end before the start is not an error, it is a correction: they are
      // choosing a new start and have not said the end yet.
      if (end <= state.start) {
        return {
          ...state,
          start: end,
          end: addMinutes(end, durationMinutes(state) || DEFAULT_DURATION_MIN),
          focus: "end",
        };
      }
      return { ...state, end };
    }

    case "setStartTime": {
      const kept = durationMinutes(state);
      const start = withMinutes(state.start, action.minutes);
      return { ...state, start, end: addMinutes(start, kept || DEFAULT_DURATION_MIN) };
    }

    case "setEndTime": {
      let end = withMinutes(state.end, action.minutes);
      // Same day, earlier clock time: they mean tomorrow. 23:00-01:00 is a
      // real booking and no error message makes it easier to enter.
      if (end <= state.start && isSameDay(end, state.start)) end = addDays(end, 1);
      if (end <= state.start) end = addMinutes(state.start, DEFAULT_DURATION_MIN);
      return { ...state, end };
    }

    case "setDuration":
      return { ...state, end: addMinutes(state.start, Math.max(5, action.minutes)) };

    default:
      return state;
  }
}

/** `2 h 30` · `45 min` · `2 días` — the label in the middle of the header. */
export function durationLabel(state: WhenState): string {
  if (state.allDay) {
    const days = Math.max(1, Math.round(durationMinutes(state) / 1440) || 1);
    return days === 1 ? "Todo el día" : `${days} días`;
  }
  const total = durationMinutes(state);
  if (total <= 0) return "—";
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const mins = total % 60;
  if (days > 0) return days === 1 ? "1 día" : `${days} días`;
  if (hours === 0) return `${mins} min`;
  return mins === 0 ? `${hours} h` : `${hours} h ${mins}`;
}

/** True when the end lands on a later day than the start — drives the "+1 día" badge. */
export function spansDays(state: WhenState): number {
  return Math.round(
    (startOfDay(state.end).getTime() - startOfDay(state.start).getTime()) / 86_400_000,
  );
}
