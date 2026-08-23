import { format, isSameDay, isSameMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { TOUCH_TARGET_HIT_AREA } from "@shared/ui";
import { WEEKDAYS, dayKey } from "../lib/calendar-range";
import type { CalendarItem } from "../api/calendar-api";

interface WeekStripProps {
  days: Date[];
  selected: Date;
  itemsByDay: Map<string, CalendarItem[]>;
  onSelect: (day: Date) => void;
}

/** Seven days, with a dot under the ones that have something on them. */
export function WeekStrip({ days, selected, itemsByDay, onSelect }: WeekStripProps) {
  const today = new Date();
  return (
    <div className="flex gap-1.5">
      {days.map((day, i) => {
        const isSelected = isSameDay(day, selected);
        const isToday = isSameDay(day, today);
        const has = (itemsByDay.get(dayKey(day)) ?? []).length > 0;
        return (
          <button
            key={dayKey(day)}
            type="button"
            onClick={() => onSelect(day)}
            aria-current={isSelected ? "date" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 rounded-xl py-2",
              TOUCH_TARGET_HIT_AREA,
              isSelected && "bg-foreground text-background",
            )}
          >
            <span
              className={cn(
                "text-[11px] font-semibold",
                isSelected
                  ? "text-background/70"
                  : // Days from a neighbouring month are dimmed rather than
                    // hidden: the strip is a week, and a week can straddle two.
                    isSameMonth(day, selected)
                    ? "text-muted-foreground"
                    : "text-faint",
              )}
            >
              {WEEKDAYS[i]}
            </span>
            <span
              className={cn(
                "text-base font-bold tabular-nums",
                isSelected ? "text-background" : isToday ? "text-primary" : "text-foreground",
              )}
            >
              {format(day, "d")}
            </span>
            <span
              className={cn(
                "size-1 rounded-full",
                has ? "" : "opacity-0",
                isSelected && "bg-background",
              )}
              style={has && !isSelected ? { background: "var(--color-accent-brand)" } : undefined}
            />
          </button>
        );
      })}
    </div>
  );
}
