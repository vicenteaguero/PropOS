import { useCallback, useMemo } from "react";
import { addWeeks } from "date-fns";
import { useSnapCarousel } from "@shared/hooks/use-snap-carousel";
import { WeekStrip } from "./week-strip";
import { dayKey, weekDaysOf, weekOf } from "../lib/calendar-range";
import type { CalendarItem } from "../api/calendar-api";

interface WeekCarouselProps {
  anchor: Date;
  itemsByDay: Map<string, CalendarItem[]>;
  onSelect: (day: Date) => void;
}

/**
 * The day strip, swipeable between weeks.
 *
 * Three weeks live in the track at any moment — previous, current, next — and
 * whichever one the user lands on becomes the current week, after which the
 * scroll silently returns to the middle. So it pages forever with three nodes.
 *
 * Picking a day from the previous or next strip moves the anchor to that exact
 * day, which is what makes choosing a day from another month move the month
 * view too: every view derives from this one date.
 */
export function WeekCarousel({ anchor, itemsByDay, onSelect }: WeekCarouselProps) {
  const weeks = useMemo(() => {
    const current = weekOf(anchor);
    return [-1, 0, 1].map((offset) => weekDaysOf(addWeeks(current, offset)));
  }, [anchor]);

  const handleSettle = useCallback(
    (delta: number) => {
      if (delta !== 0) onSelect(addWeeks(anchor, delta));
    },
    [anchor, onSelect],
  );

  const { scrollerRef } = useSnapCarousel({
    onSettle: handleSettle,
    resetKey: dayKey(weekOf(anchor)),
  });

  return (
    <div
      ref={scrollerRef}
      // `overscroll-x-contain` so paging past the last week does not hand the
      // gesture to the browser's back-swipe.
      className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {weeks.map((days) => (
        <div key={dayKey(days[0]!)} className="w-full shrink-0 snap-center px-[var(--page-x)]">
          <WeekStrip days={days} selected={anchor} itemsByDay={itemsByDay} onSelect={onSelect} />
        </div>
      ))}
    </div>
  );
}
