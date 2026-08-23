import { useEffect, useRef, useState } from "react";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { FOCUS_RING } from "./focus-ring";
import { RoundButton } from "./round-button";

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

export interface MonthGridProps {
  /** The day drawn as chosen. */
  value: Date;
  onChange: (day: Date) => void;
  /** A second day drawn as the other end of a range. */
  rangeEnd?: Date | null;
  /** Days before this cannot be chosen. */
  minDate?: Date | null;
  className?: string;
}

/**
 * A month of days you can pick one of.
 *
 * Written by hand rather than pulled from `react-day-picker` because the four
 * things this form needs — a visible duration, a start that hands over to an
 * end, the flight-search header, and an all-day switch — are none of them
 * things a date picker offers; and the shadcn `calendar.tsx` that wraps it
 * arrives with its own palette and its own idea of what a selected day looks
 * like.
 *
 * The reason it cannot overflow, which is what the two `datetime-local` inputs
 * it replaces did at 360px: seven equal columns inside `w-full`. There is no
 * intrinsic minimum to blow the layout out.
 *
 * Keyboard: arrows move a day, PageUp/PageDown a month, Home/End the week,
 * Enter/Space choose. One tab stop for the whole grid (`roving tabindex`), the
 * way a native date picker behaves.
 */
export function MonthGrid({ value, onChange, rangeEnd, minDate, className }: MonthGridProps) {
  const [month, setMonth] = useState(() => startOfMonth(value));
  const [active, setActive] = useState(() => startOfDay(value));
  const gridRef = useRef<HTMLDivElement>(null);

  // Follow the value when it changes from outside (the other half of the range
  // was picked, the form was reset): a grid still showing March after the
  // event moved to May reads as broken.
  useEffect(() => {
    setMonth(startOfMonth(value));
    setActive(startOfDay(value));
  }, [value]);

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });

  const min = minDate ? startOfDay(minDate) : null;
  const disabled = (day: Date) => !!min && day < min;

  const move = (next: Date) => {
    if (disabled(next)) return;
    setActive(next);
    if (!isSameMonth(next, month)) setMonth(startOfMonth(next));
    // Keep DOM focus on the day the arrow keys moved to.
    requestAnimationFrame(() => {
      gridRef.current
        ?.querySelector<HTMLButtonElement>(`[data-day="${format(next, "yyyy-MM-dd")}"]`)
        ?.focus();
    });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const map: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    if (e.key in map) {
      e.preventDefault();
      move(addDays(active, map[e.key]!));
      return;
    }
    if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      move(addMonths(active, e.key === "PageUp" ? -1 : 1));
      return;
    }
    if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      const week = e.key === "Home" ? startOfWeek : endOfWeek;
      move(week(active, { weekStartsOn: 1 }));
    }
  };

  const today = startOfDay(new Date());
  const start = startOfDay(value);
  const end = rangeEnd ? startOfDay(rangeEnd) : null;

  return (
    <div className={cn("select-none", className)}>
      <div className="mb-1 flex items-center justify-between">
        <RoundButton
          size={32}
          onClick={() => setMonth(addMonths(month, -1))}
          aria-label="Mes anterior"
        >
          <ChevronLeft className="size-4" strokeWidth={2} />
        </RoundButton>
        <span className="text-[13px] font-semibold capitalize text-foreground">
          {format(month, "MMMM yyyy", { locale: es })}
        </span>
        <RoundButton
          size={32}
          onClick={() => setMonth(addMonths(month, 1))}
          aria-label="Mes siguiente"
        >
          <ChevronRight className="size-4" strokeWidth={2} />
        </RoundButton>
      </div>

      <div aria-hidden className="grid grid-cols-7 gap-0.5">
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="py-1 text-center text-[10.5px] font-bold text-faint">
            {d}
          </span>
        ))}
      </div>

      {/* `tabIndex={-1}` on the grid itself: the roving tab stop lives on the
          active day button, which is what a native date picker does, but the
          role still has to be reachable programmatically. */}
      <div
        ref={gridRef}
        role="grid"
        tabIndex={-1}
        aria-label="Elegir día"
        onKeyDown={onKeyDown}
        className="grid grid-cols-7 gap-0.5 outline-none"
      >
        {days.map((day) => {
          const isStart = isSameDay(day, start);
          const isEnd = !!end && isSameDay(day, end);
          const inRange = !!end && day > start && day < end;
          const off = !isSameMonth(day, month);
          const isDisabled = disabled(day);
          return (
            <button
              key={day.toISOString()}
              type="button"
              role="gridcell"
              data-day={format(day, "yyyy-MM-dd")}
              aria-selected={isStart || isEnd}
              aria-current={isSameDay(day, today) ? "date" : undefined}
              disabled={isDisabled}
              tabIndex={isSameDay(day, active) ? 0 : -1}
              onClick={() => {
                setActive(startOfDay(day));
                onChange(startOfDay(day));
              }}
              className={cn(
                "relative grid aspect-square place-items-center rounded-lg text-[13px] font-medium tabular-nums transition",
                FOCUS_RING,
                off ? "text-faint" : "text-foreground",
                inRange && "bg-primary/12",
                (isStart || isEnd) && "bg-primary font-bold text-primary-foreground",
                !isStart && !isEnd && !isDisabled && "hover:bg-secondary",
                isDisabled && "cursor-not-allowed opacity-30",
              )}
            >
              {day.getDate()}
              {isSameDay(day, today) && !isStart && !isEnd && (
                <span aria-hidden className="absolute bottom-1 size-1 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
