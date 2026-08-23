import { useEffect } from "react";

/**
 * Freezes the page behind a full-screen surface.
 *
 * Radix dialogs do this for us; the Propo overlay is a bare `createPortal`, so
 * without it the page kept scrolling under the overlay on iOS — you could flick
 * the notes list around behind an open assistant.
 *
 * Refcounted at module level: two locked surfaces at once must not have the
 * first one to close restore scrolling for both.
 */
let locks = 0;
let previousOverflow = "";
let previousOverscroll = "";

export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof document === "undefined") return;
    const el = document.documentElement;
    if (locks === 0) {
      previousOverflow = el.style.overflow;
      previousOverscroll = el.style.overscrollBehavior;
      el.style.overflow = "hidden";
      el.style.overscrollBehavior = "contain";
    }
    locks += 1;
    return () => {
      locks = Math.max(0, locks - 1);
      if (locks === 0) {
        el.style.overflow = previousOverflow;
        el.style.overscrollBehavior = previousOverscroll;
      }
    };
  }, [active]);
}
