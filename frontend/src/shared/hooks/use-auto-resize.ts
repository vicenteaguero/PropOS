import { useEffect, type RefObject } from "react";

/**
 * Grows a textarea to fit its content, between a floor and a ceiling.
 *
 * A fixed `rows` is wrong in both directions: `rows={10}` on a three-line
 * description leaves seven empty rows staring back — which is what made the
 * property description look like an abandoned form — and the same ten rows are
 * not enough for a real listing, so the field scrolls internally while the page
 * above it has room to spare.
 *
 * `field-sizing: content` does this in CSS, but it does not exist in Safari,
 * which is the browser this product mostly runs in.
 */
export function useAutoResize(
  ref: RefObject<HTMLTextAreaElement | null>,
  value: string,
  { minPx = 120, maxPx = 520 }: { minPx?: number; maxPx?: number } = {},
): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Collapse first: scrollHeight only shrinks if the box is smaller than the
    // content, so measuring without this makes the field a one-way ratchet.
    el.style.height = "auto";
    el.style.height = `${Math.min(maxPx, Math.max(minPx, el.scrollHeight))}px`;
    el.style.overflowY = el.scrollHeight > maxPx ? "auto" : "hidden";
  }, [ref, value, minPx, maxPx]);
}
