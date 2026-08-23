import { label } from "@shared/lib/labels";
import { TYPE_META, durationLabel, statusIcon, timeLabel } from "../lib/calendar-item";
import type { CalendarItem } from "../api/calendar-api";

interface EventRowProps {
  item: CalendarItem;
  onOpen: (item: CalendarItem) => void;
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
export function EventRow({ item, onOpen }: EventRowProps) {
  const meta = TYPE_META[item.item_type];
  const StatusIcon = statusIcon(item);
  const statusText = item.status
    ? label(item.item_type === "TASK" ? "taskStatus" : "eventStatus", item.status)
    : undefined;

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="flex w-full gap-3 border-b border-border px-[var(--page-x)] py-2.5 text-left transition last:border-b-0 hover:bg-secondary/50"
    >
      <div className="w-[52px] shrink-0 text-right">
        <div className="text-[15px] font-bold tabular-nums leading-tight text-foreground">
          {timeLabel(item)}
        </div>
        <div className="text-[11px] leading-tight text-faint">{durationLabel(item)}</div>
        <div
          className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-wide"
          style={{ color: meta.dot }}
        >
          {meta.label}
        </div>
      </div>

      <span className="w-[3px] shrink-0 rounded-full" style={{ background: meta.dot }} />

      <div className="min-w-0 flex-1 self-center">
        <div className="line-clamp-2 text-[15px] font-semibold leading-snug text-foreground">
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
