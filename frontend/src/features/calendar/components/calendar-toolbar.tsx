import { ChevronLeft, ChevronRight, Mic, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionIcon, Chip, Chips, RoundButton } from "@shared/ui";
import { cn } from "@/lib/utils";
import { FILTER_ITEMS, TYPE_META, type CalFilter } from "../lib/calendar-item";

export type MobileView = "day" | "week" | "month";

const VIEW_ITEMS: { id: MobileView; label: string }[] = [
  { id: "day", label: "Día" },
  { id: "week", label: "Semana" },
  { id: "month", label: "Mes" },
];

interface CalendarToolbarProps {
  view: MobileView;
  onViewChange: (v: MobileView) => void;
  filter: CalFilter;
  onFilterChange: (f: CalFilter) => void;
  onSchedule: () => void;
  onVoice: () => void;
  canPropo: boolean;
  /**
   * Desktop keeps a stepper and its own create button.
   *
   * Not because the design differs, but because the two affordances that
   * replace them on a phone do not exist here: there is no swipeable week strip
   * to step the date, and no top bar to portal the `+` into.
   */
  variant?: "mobile" | "desktop";
  onStep?: (dir: 1 | -1) => void;
  onToday?: () => void;
  onCreate?: () => void;
  /** Month name in month view; empty elsewhere, where the grid says the dates. */
  periodLabel?: string;
}

/**
 * One row: what you are looking at, and the two ways to add to it.
 *
 * This replaces four stacked bands — a period heading, a "Hoy ← →" stepper, a
 * full-width view switch and a dashed Propo card — that between them pushed the
 * first actual event most of the way down a phone screen.
 *
 * The stepper is gone because the swipeable day strip below is the stepper, and
 * the period heading is gone because the day heading already says the date. The
 * Propo card is gone because the microphone here is the same action in a tenth
 * of the space: press the wide half to type, the round half to dictate.
 */
export function CalendarToolbar({
  view,
  onViewChange,
  filter,
  onFilterChange,
  onSchedule,
  onVoice,
  canPropo,
  variant = "mobile",
  onStep,
  onToday,
  onCreate,
  periodLabel,
}: CalendarToolbarProps) {
  const desktop = variant === "desktop";
  return (
    <div className={cn("space-y-2 pb-2 pt-2", desktop ? "px-8 pt-4" : "px-[var(--page-x)]")}>
      <div className="flex flex-wrap items-center gap-2">
        {desktop && periodLabel && (
          <h2 className="mr-1 shrink-0 text-xl font-bold tracking-tight text-foreground first-letter:uppercase">
            {periodLabel}
          </h2>
        )}
        {/* Compact on purpose: at 12px with tight padding the three labels come
            to ~140px, which is what leaves room for Agendar and the mic on one
            row at 360px — the narrowest phone we target. */}
        <div className="flex shrink-0 items-center gap-0.5 rounded-full bg-secondary p-0.5">
          {VIEW_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onViewChange(item.id)}
              aria-pressed={view === item.id}
              className={cn(
                "rounded-full px-2.5 py-1.5 text-[12px] font-semibold transition",
                view === item.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        <Button
          onClick={onSchedule}
          variant="ink"
          className={cn(
            "h-10 min-w-0 gap-1.5 rounded-full px-3 text-[13px]",
            desktop ? "shrink-0 px-4" : "flex-1",
          )}
        >
          {/* Sparkles is Propo everywhere else in the shell (the centre FAB). */}
          <Sparkles className="size-4 shrink-0" strokeWidth={2} />
          <span className="truncate">Agendar</span>
        </Button>

        {canPropo && (
          <RoundButton
            tone="muted"
            size={40}
            onClick={onVoice}
            aria-label="Agendar dictando"
            className="shrink-0 bg-primary/15 text-primary"
          >
            <Mic className="size-[18px]" strokeWidth={2} />
          </RoundButton>
        )}

        {desktop && (
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <RoundButton onClick={() => onStep?.(-1)} aria-label="Anterior">
              <ChevronLeft className="size-5" strokeWidth={1.8} />
            </RoundButton>
            <Button variant="secondary" size="sm" className="rounded-full" onClick={onToday}>
              Hoy
            </Button>
            <RoundButton onClick={() => onStep?.(1)} aria-label="Siguiente">
              <ChevronRight className="size-5" strokeWidth={1.8} />
            </RoundButton>
            <Button
              onClick={onCreate}
              variant="outline"
              size="icon"
              aria-label="Nuevo evento"
              className="ml-1 rounded-full"
            >
              <ActionIcon name="createEvent" />
            </Button>
          </div>
        )}
      </div>

      {/* The chips double as the legend for the coloured bar on each row, which
          is why this is chips and not a dropdown. */}
      <Chips>
        {FILTER_ITEMS.map((item) => (
          <Chip key={item.id} active={filter === item.id} onClick={() => onFilterChange(item.id)}>
            {item.id !== "all" && (
              <span
                aria-hidden
                className="mr-1.5 size-1.5 shrink-0 rounded-full"
                style={{ background: TYPE_META[item.id].dot }}
              />
            )}
            {item.label}
          </Chip>
        ))}
      </Chips>
    </div>
  );
}
