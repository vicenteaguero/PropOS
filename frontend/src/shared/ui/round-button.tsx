import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TOUCH_TARGET_HIT_AREA, TOUCH_TARGET_PX } from "./touch-target";

export type RoundButtonTone = "muted" | "ink" | "ghost";

const TONE: Record<RoundButtonTone, string> = {
  muted: "bg-secondary text-foreground hover:bg-muted",
  ink: "bg-ink text-ink-foreground hover:bg-foreground/90",
  ghost: "text-foreground hover:bg-secondary",
};

interface RoundButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: RoundButtonTone;
  /** diameter in px (default 40) */
  size?: number;
  /**
   * Take the same coarse-pointer step every other bar control takes.
   *
   * The diameter is an inline style, so `CONTROL_H`'s
   * `[@media(pointer:coarse)]:h-11` cannot reach it — a `RoundButton` in a row
   * of `CONTROL_H` siblings painted 40px next to their 44px, on a phone only.
   * `TOUCH_TARGET_HIT_AREA` grew the tappable box but never the circle, so the
   * row still looked ragged.
   *
   * Opt-in rather than automatic: plenty of these are not in a bar row, and
   * growing every circle in the app by 4px on touch is a different change.
   */
  inBar?: boolean;
  children: ReactNode;
}

/** Circular icon button (Uber-style). Pass a lucide icon as children. */
export function RoundButton({
  tone = "muted",
  size = 40,
  inBar = false,
  className,
  children,
  type = "button",
  ...props
}: RoundButtonProps) {
  return (
    <button
      type={type}
      // No inline style in a bar row. An inline `width`/`height` beats every
      // class, which is the whole reason this control could never take the
      // coarse-pointer step: the size came from the style attribute and the
      // media query lived in a class it always lost to.
      style={inBar ? undefined : { width: size, height: size }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full transition active:scale-90 disabled:pointer-events-none disabled:opacity-50",
        // Below 44px the painted circle stays put but the tappable box grows.
        !inBar && size < TOUCH_TARGET_PX && TOUCH_TARGET_HIT_AREA,
        // In a bar row the circle itself steps up, so it lands on the same
        // 40/44 as the `CONTROL_H` siblings beside it. `size` is ignored here
        // on purpose — a bar control's height is the token's to decide.
        inBar && "size-10 [@media(pointer:coarse)]:size-11",
        TONE[tone],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
