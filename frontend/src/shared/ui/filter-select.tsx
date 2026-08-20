import { Check, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { TOUCH_TARGET_ROW_COARSE } from "./touch-target";

export interface FilterOption {
  value: string;
  label: string;
  /** Second line — a comuna, a state, a count. */
  sub?: string;
  /** Leading glyph. Rendered bare, with no chip or tinted square behind it. */
  icon?: ReactNode;
}

interface FilterSelectProps {
  /** Shown before a choice is made, and as the group's name once one is. */
  label: string;
  value: string | null;
  options: FilterOption[];
  onChange: (value: string | null) => void;
  /** Label for the "no filter" entry. Omit to make the filter mandatory. */
  allLabel?: string;
  className?: string;
}

/**
 * A filter that collapses to one control instead of a row of chips.
 *
 * Chip rows do not survive contact with real data: ten contact types or forty
 * properties become a horizontally scrolling strip where most options are off
 * screen and the active one may not even be visible. A dropdown states the
 * current choice in place, costs one line whatever the option count, and can
 * carry a second line per option — which a chip cannot.
 */
export function FilterSelect({
  label,
  value,
  options,
  onChange,
  allLabel,
  className,
}: FilterSelectProps) {
  const active = options.find((o) => o.value === value) ?? null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition",
            TOUCH_TARGET_ROW_COARSE,
            active
              ? "border-foreground bg-foreground text-background"
              : "border-border text-muted-foreground hover:text-foreground",
            className,
          )}
        >
          {active?.icon}
          <span className="truncate">{active ? active.label : label}</span>
          <ChevronDown className="size-3.5 shrink-0 opacity-70" strokeWidth={2.25} />
        </button>
      </DropdownMenuTrigger>
      {/* Bounded height: the property list is the point of this component and it
          runs to dozens of entries. */}
      <DropdownMenuContent align="start" className="max-h-80 w-64 overflow-y-auto">
        {allLabel && (
          <DropdownMenuItem onClick={() => onChange(null)} className="gap-2">
            <span className="flex-1">{allLabel}</span>
            {value === null && <Check className="size-4" />}
          </DropdownMenuItem>
        )}
        {options.map((o) => (
          <DropdownMenuItem key={o.value} onClick={() => onChange(o.value)} className="gap-2">
            {o.icon}
            <span className="min-w-0 flex-1">
              <span className="block truncate">{o.label}</span>
              {o.sub && (
                <span className="block truncate text-[12px] text-muted-foreground">{o.sub}</span>
              )}
            </span>
            {value === o.value && <Check className="size-4 shrink-0" />}
          </DropdownMenuItem>
        ))}
        {options.length === 0 && (
          <p className="px-2 py-1.5 text-[13px] text-muted-foreground">Sin opciones</p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
