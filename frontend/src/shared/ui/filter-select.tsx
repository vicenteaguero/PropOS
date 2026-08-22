import { useState, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsDesktop } from "@/hooks/use-mobile";
import { BottomSheet } from "./bottom-sheet";
import { cn } from "@/lib/utils";
import { CONTROL_H } from "./touch-target";

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
 * screen and the active one may not even be visible. This states the current
 * choice in place, costs one line whatever the option count, and can carry a
 * second line per option — which a chip cannot.
 *
 * It opens as a dropdown on a mouse and as a bottom sheet on a finger. The
 * dropdown alone anchored a 256px panel to a control near the right edge of a
 * 390px screen, so it opened half off-canvas with 36px rows: a menu drawn for a
 * cursor, handed to a thumb.
 */
export function FilterSelect({
  label,
  value,
  options,
  onChange,
  allLabel,
  className,
}: FilterSelectProps) {
  const isDesktop = useIsDesktop();
  const [sheetOpen, setSheetOpen] = useState(false);
  const active = options.find((o) => o.value === value) ?? null;

  const trigger = (
    <button
      type="button"
      onClick={isDesktop ? undefined : () => setSheetOpen(true)}
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition",
        // The shared header-row height. This control used to carry none at all,
        // so it was sized by its 13px text — ~28px next to a 40px channel
        // switch, in the same `items-center` row.
        CONTROL_H,
        active
          ? "border-foreground bg-ink text-ink-foreground"
          : "border-border text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      {active?.icon}
      <span className="truncate">{active ? active.label : label}</span>
      <ChevronDown className="size-3.5 shrink-0 opacity-70" strokeWidth={2.25} />
    </button>
  );

  if (!isDesktop) {
    return (
      <>
        {trigger}
        <BottomSheet open={sheetOpen} onOpenChange={setSheetOpen} title={label}>
          <div className="mt-1">
            {allLabel && (
              <SheetOption
                label={allLabel}
                selected={value === null}
                onClick={() => {
                  onChange(null);
                  setSheetOpen(false);
                }}
              />
            )}
            {options.map((o) => (
              <SheetOption
                key={o.value}
                label={o.label}
                sub={o.sub}
                icon={o.icon}
                selected={value === o.value}
                onClick={() => {
                  onChange(o.value);
                  setSheetOpen(false);
                }}
              />
            ))}
            {options.length === 0 && (
              <p className="py-3 text-[14px] text-muted-foreground">Sin opciones</p>
            )}
          </div>
        </BottomSheet>
      </>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
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

function SheetOption({
  label,
  sub,
  icon,
  selected,
  onClick,
}: {
  label: string;
  sub?: string;
  icon?: ReactNode;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-12 w-full items-center gap-3 border-b border-border py-2.5 text-left last:border-b-0"
    >
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium text-foreground">{label}</span>
        {sub && <span className="block truncate text-[13px] text-muted-foreground">{sub}</span>}
      </span>
      {selected && <Check className="size-[18px] shrink-0 text-primary" strokeWidth={2.4} />}
    </button>
  );
}
