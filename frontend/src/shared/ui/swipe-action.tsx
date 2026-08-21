import { useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SwipeActionProps {
  /** Fired once the row is dragged past the threshold and released. */
  onAction: () => void;
  /** Painted on the track the row slides off. */
  icon: ReactNode;
  label: string;
  /** Track colour. Defaults to the neutral ink surface. */
  tone?: "neutral" | "destructive";
  children: ReactNode;
  className?: string;
}

/** Past this many pixels the release commits instead of springing back. */
const COMMIT_PX = 96;
/** Below this, the gesture is a tap or a vertical scroll, not a swipe. */
const START_PX = 12;

/**
 * Swipe a list row sideways to run its one action.
 *
 * The archive control was a 32px round button revealed on hover — a pointer
 * affordance, on the surface a broker uses standing in a lobby. On a phone it
 * was permanently visible and permanently competing with the row's own text, or
 * (worse) reachable only by long-press menus that do not exist here. Every
 * messaging app the same person already uses archives with a horizontal drag,
 * so the gesture needs no teaching.
 *
 * Horizontal intent is claimed only after the finger has clearly committed to
 * an axis; until then the list scrolls normally, which is what the same gesture
 * means 95% of the time.
 */
export function SwipeAction({
  onAction,
  icon,
  label,
  tone = "neutral",
  children,
  className,
}: SwipeActionProps) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const axis = useRef<"none" | "x" | "y">("none");

  const end = () => {
    if (axis.current === "x" && dx >= COMMIT_PX) onAction();
    start.current = null;
    axis.current = "none";
    setDragging(false);
    setDx(0);
  };

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {/* The track only paints while the row is actually off it. */}
      {dx > 0 && (
        <div
          aria-hidden
          className={cn(
            "absolute inset-y-0 left-0 flex items-center gap-2 px-4 text-[13px] font-semibold",
            tone === "destructive"
              ? "bg-destructive text-destructive-foreground"
              : "bg-ink text-ink-foreground",
          )}
          style={{ width: Math.max(dx, 0) }}
        >
          <span className="shrink-0">{icon}</span>
          {dx >= COMMIT_PX && <span className="truncate">{label}</span>}
        </div>
      )}
      <div
        style={{ transform: `translateX(${dx}px)` }}
        className={cn("bg-background", !dragging && "transition-transform duration-200")}
        onTouchStart={(e) => {
          const t = e.touches[0];
          if (!t) return;
          start.current = { x: t.clientX, y: t.clientY };
        }}
        onTouchMove={(e) => {
          const t = e.touches[0];
          const s = start.current;
          if (!t || !s) return;
          const mx = t.clientX - s.x;
          const my = t.clientY - s.y;
          if (axis.current === "none") {
            if (Math.abs(mx) < START_PX && Math.abs(my) < START_PX) return;
            // Whichever axis moved more wins, once. Re-deciding mid-gesture is
            // what makes a row twitch sideways while the list is scrolling.
            axis.current = Math.abs(mx) > Math.abs(my) ? "x" : "y";
            if (axis.current === "x") setDragging(true);
          }
          if (axis.current !== "x") return;
          // Rightward only, and damped past the commit point so the row cannot
          // be flung off the screen.
          const next = mx <= 0 ? 0 : mx <= COMMIT_PX ? mx : COMMIT_PX + (mx - COMMIT_PX) * 0.35;
          setDx(next);
        }}
        onTouchEnd={end}
        onTouchCancel={end}
      >
        {children}
      </div>
    </div>
  );
}
