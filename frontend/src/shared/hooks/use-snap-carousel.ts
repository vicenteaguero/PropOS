import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

interface SnapCarouselOptions {
  /** Index of the page that is "now". Default 1, i.e. prev · current · next. */
  center?: number;
  /** How many pages the user travelled once the scroll settles. */
  onSettle: (delta: number) => void;
  /** Re-centre when this changes — pass whatever identifies the current page. */
  resetKey?: unknown;
}

export interface SnapCarousel {
  scrollerRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * A snap track of 2n+1 pages that always returns to the middle.
 *
 * Infinite paging with three DOM nodes: the user swipes to the next page, we
 * report the delta so the owner can move its anchor, and then we silently put
 * the scroll position back in the middle so there is always another page in
 * both directions.
 *
 * Built on CSS scroll-snap rather than a pointer-drag because the browser
 * already implements momentum, rubber-banding, trackpads and keyboards, and —
 * the part a hand-rolled gesture usually gets wrong — it cannot fight the
 * page's own vertical scrolling.
 */
export function useSnapCarousel({
  center = 1,
  onSettle,
  resetKey,
}: SnapCarouselOptions): SnapCarousel {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const recentering = useRef(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const recentre = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    recentering.current = true;
    // Snap off for the jump: with it on, assigning scrollLeft can be animated
    // and re-fire the settle handler, which reads as a second swipe.
    const previous = el.style.scrollSnapType;
    el.style.scrollSnapType = "none";
    el.scrollLeft = center * el.clientWidth;
    el.style.scrollSnapType = previous;
    // Next frame: the scroll event from the assignment must land first.
    requestAnimationFrame(() => {
      recentering.current = false;
    });
  }, [center]);

  // After the owner swaps the pages for the new anchor, put us back in the
  // middle. Layout effect so it happens before paint and never flashes.
  useLayoutEffect(() => {
    recentre();
  }, [recentre, resetKey]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const settle = () => {
      if (recentering.current) return;
      const page = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
      if (page !== center) onSettle(page - center);
    };

    // `scrollend` where it exists (Chrome, and Safari since 17); a debounced
    // `scroll` everywhere else, so no platform is left without the gesture.
    const supportsScrollEnd = "onscrollend" in el;
    const onScroll = () => {
      if (supportsScrollEnd) return;
      if (settleTimer.current) clearTimeout(settleTimer.current);
      settleTimer.current = setTimeout(settle, 120);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    if (supportsScrollEnd) el.addEventListener("scrollend", settle);
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (supportsScrollEnd) el.removeEventListener("scrollend", settle);
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
  }, [center, onSettle]);

  return { scrollerRef };
}
