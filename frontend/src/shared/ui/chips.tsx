import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CONTROL_H } from "./touch-target";

const NO_SCROLLBAR =
  "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

interface ChipsProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/** Horizontal, scrollable row of filter chips. */
export function Chips({ className, children, ...props }: ChipsProps) {
  return (
    <div className={cn("flex gap-2 overflow-x-auto", NO_SCROLLBAR, className)} {...props}>
      {children}
    </div>
  );
}

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  /** optional trailing count */
  count?: number;
  children: ReactNode;
}

/** Single filter chip. Selected = ink fill. */
export function Chip({ active, count, className, children, type = "button", ...props }: ChipProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-3.5 text-[13px] font-semibold transition",
        CONTROL_H,
        active
          ? "border-foreground bg-ink text-ink-foreground"
          : "border-line-strong text-foreground hover:bg-secondary",
        className,
      )}
      {...props}
    >
      {children}
      {count != null && <span className="ml-1.5 opacity-60">{count}</span>}
    </button>
  );
}
