import { label } from "@shared/lib/labels";
import { cn } from "@/lib/utils";
import { itemMeta, durationLabel, statusIcon, timeLabel } from "../lib/calendar-item";
import type { TypeResolver } from "../lib/calendar-item";
import type { CalendarItem } from "../api/calendar-api";

interface EventRowProps {
  item: CalendarItem;
  onOpen: (item: CalendarItem) => void;
  /** From `useEventTypes()`. Absent falls back to the source colour. */
  resolveType?: TypeResolver;
  /** Already happened: shorter and quieter, but still readable and tappable. */
  past?: boolean;
}

/**
 * One item, in about 60px instead of 86.
 *
 * Three things bought that back. The type ("EVENTO", "TAREA") moved out of its
 * own full-width line and under the time, where there was already empty space
 * in the left rail. The status stopped being a third line of text and became a
 * glyph on the right — and only when it is not the boring default. And the gap
 * between rows became a hairline, because a gap between items of the same day
 * implies a grouping that is not there.
 *
 * What the space went to is the title, which can now use two lines.
 */
export function EventRow({ item, onOpen, resolveType, past = false }: EventRowProps) {
  const meta = itemMeta(item, resolveType);
  const priority = item.priority ?? 0;
  const StatusIcon = statusIcon(item);
  const statusText = item.status
    ? label(item.item_type === "TASK" ? "taskStatus" : "eventStatus", item.status)
    : undefined;

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={cn(
        "flex w-full gap-3 border-b border-border px-[var(--page-x)] text-left transition last:border-b-0 hover:bg-secondary/50",
        // A past event is context, not work. It keeps its full height on the
        // day you are looking at it — hiding it would break the shape of the
        // day — but it stops competing with what has not happened yet.
        past ? "py-1.5 opacity-55" : "py-2.5",
      )}
    >
      <div className="w-[52px] shrink-0 text-right">
        <div className="text-[15px] font-bold tabular-nums leading-tight text-foreground">
          {timeLabel(item)}
        </div>
        {!past && <div className="text-[11px] leading-tight text-faint">{durationLabel(item)}</div>}
        <div
          className={cn(
            "truncate text-[10px] font-bold uppercase tracking-wide",
            !past && "mt-0.5",
          )}
          style={{ color: meta.ink }}
        >
          {meta.label}
        </div>
      </div>

      {/* The bar carries the type's colour; its WIDTH carries the priority.
          A separate badge would have been a fourth thing competing for a row
          that already holds a time, a type, a title and a status. */}
      <span
        className={cn("shrink-0 rounded-full", priority >= 2 ? "w-[5px]" : "w-[3px]")}
        style={{ background: meta.ink }}
      />

      <div className="min-w-0 flex-1 self-center">
        <div
          className={cn(
            "text-[15px] leading-snug text-foreground",
            priority >= 1 ? "font-bold" : "font-semibold",
            past ? "truncate" : "line-clamp-2",
          )}
        >
          {item.title ?? "Sin título"}
        </div>
      </div>

      {StatusIcon && (
        // `title` rather than a visible label: the state is worth a glance, not
        // a line. Spanish comes from the registry, never `toLowerCase()`.
        <span className="shrink-0 self-center" title={statusText} aria-label={statusText}>
          <StatusIcon className="size-4 text-muted-foreground" strokeWidth={1.9} />
        </span>
      )}
    </button>
  );
}
