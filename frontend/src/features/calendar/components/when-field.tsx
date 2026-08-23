import { useReducer, useEffect, useRef } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowRight } from "lucide-react";
import { MonthGrid } from "@shared/ui";
import { ChoiceSwitch, CONTROL_H, FOCUS_RING } from "@shared/ui";
import { cn } from "@/lib/utils";
import {
  durationLabel,
  initialWhen,
  spansDays,
  whenReducer,
  type WhenState,
} from "../lib/when-reducer";

interface WhenFieldProps {
  start: Date;
  end: Date | null;
  allDay: boolean;
  onChange: (next: { start: Date; end: Date; allDay: boolean }) => void;
}

const asTimeValue = (d: Date) => format(d, "HH:mm");
const parseTime = (value: string): number | null => {
  const [h, m] = value.split(":").map(Number);
  if (h === undefined || m === undefined || Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
};

/**
 * When the event happens, as one control.
 *
 * The layout is a flight search on purpose, and for a structural reason rather
 * than a stylistic one: the header is `grid-cols-[1fr_auto_1fr]` with the
 * duration in the centre track, and two grid tracks cannot overlap. The pair of
 * `datetime-local` inputs this replaces sat in `grid-cols-2`, and that control
 * has a large intrinsic minimum width, so at 360px they collided — which is
 * what "se rompe" was.
 *
 * The rules live in `when-reducer.ts`, where they can be tested without a DOM.
 */
export function WhenField({ start, end, allDay, onChange }: WhenFieldProps) {
  const [state, dispatch] = useReducer(
    whenReducer,
    { start, end, allDay },
    (init: { start: Date; end: Date | null; allDay: boolean }): WhenState =>
      initialWhen(init.start, init.end, init.allDay),
  );

  // Report upward, but never on the first render — that would mark a pristine
  // edit form as dirty before the user has touched anything.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    onChange({ start: state.start, end: state.end, allDay: state.allDay });
    // `onChange` is a fresh closure on every parent render; depending on it
    // here would fire this effect on every keystroke elsewhere in the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.start, state.end, state.allDay]);

  const overnight = spansDays(state);
  const editing = state.focus;

  return (
    <div className="rounded-xl border border-border">
      {/* Header: start · duration · end. Tapping either half aims the grid. */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-stretch">
        <Half
          label="Inicio"
          day={state.start}
          active={editing === "start"}
          onClick={() => dispatch({ type: "focus", on: "start" })}
        />
        <div className="flex flex-col items-center justify-center px-2 py-2">
          <ArrowRight aria-hidden className="size-3.5 text-faint" strokeWidth={2} />
          <span className="mt-0.5 whitespace-nowrap text-[11px] font-semibold text-muted-foreground">
            {durationLabel(state)}
          </span>
        </div>
        <Half
          label="Término"
          day={state.end}
          active={editing === "end"}
          align="right"
          badge={overnight > 0 ? `+${overnight} día${overnight === 1 ? "" : "s"}` : undefined}
          onClick={() => dispatch({ type: "focus", on: "end" })}
        />
      </div>

      <div className="border-t border-border p-3">
        <MonthGrid
          value={editing === "start" ? state.start : state.end}
          rangeEnd={editing === "start" ? state.end : null}
          onChange={(day) => dispatch({ type: "pickDay", day })}
        />

        {!state.allDay && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <TimeInput
              label="Hora de inicio"
              value={asTimeValue(state.start)}
              onCommit={(minutes) => dispatch({ type: "setStartTime", minutes })}
            />
            <TimeInput
              label="Hora de término"
              value={asTimeValue(state.end)}
              onCommit={(minutes) => dispatch({ type: "setEndTime", minutes })}
            />
          </div>
        )}

        {!state.allDay && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[30, 60, 90, 120].map((m) => {
              const chosen =
                Math.round((state.end.getTime() - state.start.getTime()) / 60000) === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => dispatch({ type: "setDuration", minutes: m })}
                  aria-pressed={chosen}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[12px] font-medium transition",
                    FOCUS_RING,
                    chosen
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:bg-secondary",
                  )}
                >
                  {m < 60 ? `${m} min` : `${m / 60} h`}
                </button>
              );
            })}
          </div>
        )}

        {/* Two named outcomes rather than a checkbox: "Todo el día ☐" makes
            the reader work out what the unticked box means. */}
        <ChoiceSwitch
          label="Duración"
          value={state.allDay ? "allDay" : "timed"}
          options={[
            { value: "timed", label: "Con hora" },
            { value: "allDay", label: "Todo el día" },
          ]}
          onChange={(next) => {
            if ((next === "allDay") !== state.allDay) dispatch({ type: "toggleAllDay" });
          }}
          className="mt-3"
        />
      </div>
    </div>
  );
}

function Half({
  label,
  day,
  active,
  align = "left",
  badge,
  onClick,
}: {
  label: string;
  day: Date;
  active: boolean;
  align?: "left" | "right";
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "min-w-0 px-3 py-2.5 transition",
        align === "right" ? "text-right" : "text-left",
        FOCUS_RING,
        active ? "bg-secondary" : "hover:bg-secondary/60",
        align === "right" ? "rounded-tr-xl" : "rounded-tl-xl",
      )}
    >
      <span className="block text-[11px] font-semibold uppercase tracking-wide text-faint">
        {label}
      </span>
      <span className="mt-0.5 block truncate text-[15px] font-bold leading-tight text-foreground">
        {format(day, "EEE d MMM", { locale: es })}
      </span>
      <span className="block text-[12px] tabular-nums text-muted-foreground">
        {format(day, "HH:mm")}
        {badge && <span className="ml-1 font-semibold text-primary">{badge}</span>}
      </span>
    </button>
  );
}

/**
 * A bare `<input type="time">`, out on its own.
 *
 * The problem was never the time part — it was `datetime-local`, whose date
 * half carries the intrinsic width. A time input is ~90px and fits two to a row
 * on the narrowest phone we target.
 */
function TimeInput({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: string;
  onCommit: (minutes: number) => void;
}) {
  return (
    <input
      type="time"
      aria-label={label}
      value={value}
      onChange={(e) => {
        const minutes = parseTime(e.target.value);
        if (minutes !== null) onCommit(minutes);
      }}
      className={cn(
        CONTROL_H,
        "w-full min-w-0 rounded-lg border border-border bg-transparent px-3 text-center text-[15px] font-semibold tabular-nums text-foreground",
        FOCUS_RING,
      )}
    />
  );
}
