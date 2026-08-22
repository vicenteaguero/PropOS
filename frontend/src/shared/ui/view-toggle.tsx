import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CONTROL_H } from "./touch-target";

export interface ViewToggleOption<T extends string> {
  value: T;
  icon: ReactNode;
  /** Accessible name — the control is icon-only by design. */
  label: string;
}

interface ViewToggleProps<T extends string> {
  value: T;
  options: ViewToggleOption<T>[];
  onChange: (value: T) => void;
  className?: string;
}

/**
 * Icon switch for "the same data, shown another way" — list vs map, grid vs
 * rows.
 *
 * Deliberately NOT a tab bar. A tab bar announces "these are different places"
 * and costs a full row; stacking one under the section tabs and again under a
 * page title gave three rows of tabs before any content. A two-state icon reads
 * as a setting, which is what a view mode is, and costs 36px on one line.
 */
export function ViewToggle<T extends string>({
  value,
  options,
  onChange,
  className,
}: ViewToggleProps<T>) {
  return (
    <div
      // The height lives on the TRACK, not on the buttons: a `size-8` button
      // inside a `p-0.5` track paints 36px, so the switch never matched the
      // 40px controls beside it. Buttons now fill whatever the track is.
      className={cn(
        "inline-flex shrink-0 items-center rounded-full bg-muted p-0.5",
        CONTROL_H,
        className,
      )}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-label={o.label}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex aspect-square h-full items-center justify-center rounded-full transition",
            o.value === value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.icon}
        </button>
      ))}
    </div>
  );
}
