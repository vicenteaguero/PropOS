import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TOUCH_TARGET_HIT_AREA, TOUCH_TARGET_PX } from "./touch-target";

export type RoundButtonTone = "muted" | "ink" | "ghost";

const TONE: Record<RoundButtonTone, string> = {
  muted: "bg-secondary text-foreground hover:bg-muted",
  ink: "bg-foreground text-background hover:bg-foreground/90",
  ghost: "text-foreground hover:bg-secondary",
};

interface RoundButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: RoundButtonTone;
  /** diameter in px (default 40) */
  size?: number;
  children: ReactNode;
}

/** Circular icon button (Uber-style). Pass a lucide icon as children. */
export function RoundButton({
  tone = "muted",
  size = 40,
  className,
  children,
  type = "button",
  ...props
}: RoundButtonProps) {
  return (
    <button
      type={type}
      style={{ width: size, height: size }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full transition active:scale-90 disabled:pointer-events-none disabled:opacity-50",
        // Below 44px the painted circle stays put but the tappable box grows.
        size < TOUCH_TARGET_PX && TOUCH_TARGET_HIT_AREA,
        TONE[tone],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
