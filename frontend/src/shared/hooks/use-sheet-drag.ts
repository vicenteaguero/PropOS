import { useCallback, useRef, useState } from "react";

/** Past this many pixels a release closes instead of springing back. */
const COMMIT_PX = 110;
/** Or this fast, in px/ms — a flick closes without travelling the distance. */
const COMMIT_VELOCITY = 0.55;
/**
 * A flick needs BOTH a real elapsed time and real travel before its velocity
 * means anything. Two touch events can carry the same timestamp — a coalesced
 * pair, or a synthetic one — and dividing by that gave an arbitrarily large
 * velocity, so a 40px nudge closed the sheet. Dismissing on an undefined
 * velocity is the accidental close this whole gesture has to avoid.
 */
const MIN_FLICK_MS = 16;
const MIN_FLICK_PX = 40;
/** Below this the finger has not committed to an axis yet. */
const START_PX = 8;
/** Resistance above the top edge, so the sheet cannot be dragged upward. */
const OVERDRAG = 0.12;

interface SheetDrag {
  /** Spread onto the sheet's scrolling content element. */
  handlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
    onTouchCancel: () => void;
  };
  /** Inline transform for the sheet. */
  style: React.CSSProperties;
  /** True while a finger is moving it — the caller disables its transition. */
  dragging: boolean;
}

/**
 * Drag a bottom sheet down to dismiss it.
 *
 * The grab handle at the top of every sheet in this app looked draggable and
 * was not — it was a close button wearing a drag affordance, which is the one
 * gesture every phone user tries first on a sheet. Radix has no dismissal
 * animation hook, but `SheetContent` spreads DOM props, so the gesture drives
 * an inline `translateY` and hands off to the existing CSS slide-out when it
 * commits.
 *
 * The subtle part is the sheet's own scroll. The content is `overflow-y-auto`,
 * so a downward drag and a scroll-up are the same gesture; the drag is only
 * claimed when the content is already at `scrollTop === 0` and the finger is
 * moving down. Once either axis wins it keeps the gesture, so a sheet does not
 * twitch sideways mid-scroll.
 */
export function useSheetDrag(onDismiss: () => void): SheetDrag {
  const [dy, setDy] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  const last = useRef<{ y: number; t: number } | null>(null);
  const axis = useRef<"none" | "drag" | "scroll">("none");

  const end = useCallback(() => {
    const s = start.current;
    const l = last.current;
    let commit = false;
    if (axis.current === "drag" && s && l) {
      const elapsed = l.t - s.t;
      const travelled = l.y - s.y;
      const flicked =
        elapsed >= MIN_FLICK_MS &&
        travelled >= MIN_FLICK_PX &&
        travelled / elapsed >= COMMIT_VELOCITY;
      commit = dy >= COMMIT_PX || flicked;
    }
    start.current = null;
    last.current = null;
    axis.current = "none";
    setDragging(false);
    setDy(0);
    if (commit) onDismiss();
  }, [dy, onDismiss]);

  const handlers = {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      start.current = { x: t.clientX, y: t.clientY, t: e.timeStamp };
      last.current = { y: t.clientY, t: e.timeStamp };
      axis.current = "none";
    },
    onTouchMove: (e: React.TouchEvent) => {
      const t = e.touches[0];
      const s = start.current;
      if (!t || !s) return;
      const my = t.clientY - s.y;
      const mx = t.clientX - s.x;
      last.current = { y: t.clientY, t: e.timeStamp };

      if (axis.current === "none") {
        if (Math.abs(my) < START_PX && Math.abs(mx) < START_PX) return;
        // Downward, mostly vertical, and only from the very top of the scroll:
        // anywhere else the same gesture means "scroll this sheet".
        const atTop = (e.currentTarget as HTMLElement).scrollTop <= 0;
        axis.current = my > 0 && Math.abs(my) > Math.abs(mx) && atTop ? "drag" : "scroll";
        if (axis.current === "drag") setDragging(true);
      }
      if (axis.current !== "drag") return;
      // Upward is resisted rather than blocked, so the sheet feels attached to
      // the finger instead of stuck.
      setDy(my >= 0 ? my : my * OVERDRAG);
    },
    onTouchEnd: end,
    onTouchCancel: end,
  };

  return {
    handlers,
    style: dy ? { transform: `translateY(${dy}px)` } : {},
    dragging,
  };
}
