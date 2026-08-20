import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

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
    <div className={cn("inline-flex shrink-0 rounded-full bg-muted p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-label={o.label}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex size-8 items-center justify-center rounded-full transition [@media(pointer:coarse)]:size-9",
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
