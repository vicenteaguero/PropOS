import { useSyncExternalStore } from "react";
import { getViewportSnapshot, subscribeViewport } from "@shared/lib/viewport-store";

/**
 * Whether the on-screen keyboard is up.
 *
 * The geometry itself is published as CSS custom properties on <html> by
 * `shared/lib/viewport-store` — `--kb-inset`, `--kb-open`, `--vv-h`, `--vv-top`
 * — so surfaces position themselves in CSS and this hook exists only for the
 * handful of places that need the boolean in JS (hiding suggestions once half
 * the screen is keyboard).
 *
 * iOS Safari does not resize the layout viewport when the keyboard opens: the
 * page keeps its height and the keys simply cover the bottom. `visualViewport`
 * is the only API that reports the covered strip.
 *
 * Safe to call from as many surfaces as you like — the store refcounts, and the
 * variables survive until the last one unmounts. That was not always true: each
 * surface used to run its own copy and remove all four properties on unmount,
 * so closing one surface broke every other one that was still open.
 *
 * Consume the inset as `pb-[calc(var(--kb-inset,0px)+…)]`, and drop
 * `--safe-bottom` while it is non-zero — the home indicator is under the keys.
 */
export function useKeyboardInset(): { open: boolean } {
  const open = useSyncExternalStore(
    subscribeViewport,
    () => getViewportSnapshot().kbOpen,
    () => false,
  );
  return { open };
}
