import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { FOCUS_RING, TOUCH_TARGET_ROW_COARSE } from "@shared/ui";

export interface ChoiceOption {
  value: string;
  label: string;
  /** Classes for the selected state. Lets one option carry a warning tone. */
  activeClassName?: string;
  icon?: ReactNode;
}

/**
 * A setting that names every outcome, instead of a checkbox.
 *
 * "Bloquea el cierre ☐" makes the reader work out what the unticked box means,
 * and the meanings are rarely symmetric — one stops a sale, the other is a
 * reminder. Naming each side and letting the chosen one take a colour is the
 * difference between a setting you can read and one you have to remember. The
 * same shape carries three options where there are three (a stage move is
 * forbidden, or Propo may make it, or only a person may).
 *
 * A radiogroup rather than a `TabBar`: this is a value, not navigation, and
 * `TabBar` scrolls its selection into view on mount — a page holding a dozen
 * of them would jump.
 */
export function ChoiceSwitch({
  label,
  value,
  options,
  onChange,
  className,
  size = "md",
}: {
  /** Accessible name for the group. */
  label: string;
  value: string;
  options: ChoiceOption[];
  onChange: (value: string) => void;
  className?: string;
  /** `sm` for dense rows — a settings list with one switch per row. */
  size?: "sm" | "md";
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("inline-flex gap-1 rounded-full bg-secondary p-1", className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap transition-colors",
              size === "sm" ? "h-9 px-3 text-[12px]" : "h-10 px-3.5 text-[13px]",
              TOUCH_TARGET_ROW_COARSE,
              FOCUS_RING,
              active
                ? (option.activeClassName ?? "bg-ink text-ink-foreground")
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
