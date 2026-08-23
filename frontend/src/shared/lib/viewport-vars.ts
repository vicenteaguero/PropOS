/**
 * The visual-viewport maths, as pure functions.
 *
 * Split out from the hook so the keyboard logic can be tested without a DOM and
 * without a phone. Every branch below corresponds to a real device behaviour
 * that a laptop cannot reproduce, so tests are the only way this stays correct.
 */

export interface ViewportReading {
  /** `window.innerHeight` — the LAYOUT viewport. */
  innerHeight: number;
  /** `visualViewport.height` — the visible box. */
  vvHeight: number;
  /** `visualViewport.offsetTop` — how far the visible box has scrolled down. */
  vvOffsetTop: number;
}

export interface ViewportSnapshot {
  /** Pixels of the layout viewport covered below the visible box. iOS: the keyboard. */
  kbInset: number;
  kbOpen: boolean;
  vvHeight: number;
  vvTop: number;
}

export interface ComputeInput {
  reading: ViewportReading;
  /** Tallest layout viewport seen so far. 0 when unknown (cold start). */
  restHeight: number;
  /** Whether an input/textarea/contenteditable currently has focus. */
  editableFocused: boolean;
  /** The previous `kbOpen`. Drives the latch — see below. */
  wasOpen: boolean;
}

/** Below this the strip is a URL bar or a rounding artefact, not a keyboard. */
const KEYBOARD_MIN_PX = 80;

export function isEditableElement(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  // Both, on purpose: `isContentEditable` is the correct runtime answer because
  // it inherits (a <span> inside an editable <div> is editable), but jsdom does
  // not implement it, and the attribute check also catches a host that has not
  // computed the property yet.
  if ((el as HTMLElement).isContentEditable) return true;
  const attr = el.getAttribute?.("contenteditable");
  return attr === "" || attr === "true" || attr === "plaintext-only";
}

export function sameSnapshot(a: ViewportSnapshot, b: ViewportSnapshot): boolean {
  return (
    a.kbInset === b.kbInset &&
    a.kbOpen === b.kbOpen &&
    a.vvHeight === b.vvHeight &&
    a.vvTop === b.vvTop
  );
}

/**
 * One reading in, one snapshot plus the updated `restHeight` out.
 *
 * `covered` is deliberately LAYOUT-viewport-relative, not device-relative: when
 * iOS scrolls the visual viewport under a focused input, `offsetTop` grows and
 * `covered` shrinks — which is right, because `.pb-composer` pads an element
 * positioned in the layout viewport, and the distance from it to the visible
 * bottom really is `innerHeight - (offsetTop + vvHeight)`. Do not "simplify"
 * this to `innerHeight - vvHeight`.
 *
 * `shrunk` is the Android path: with `interactive-widget=resizes-content` the
 * LAYOUT viewport itself shrinks, so `covered` is ~0 and the only evidence of a
 * keyboard is that the page got shorter than the tallest we ever saw.
 */
export function computeSnapshot(input: ComputeInput): {
  snapshot: ViewportSnapshot;
  restHeight: number;
} {
  const { reading, editableFocused, wasOpen } = input;
  const { innerHeight, vvHeight, vvOffsetTop } = reading;

  // Seed from the reading itself when unknown: `vvHeight + offsetTop` is a lower
  // bound on the layout viewport, which rescues a cold start that happens while
  // the keyboard is already up.
  const seeded = input.restHeight || Math.max(innerHeight, vvHeight + vvOffsetTop);
  const restHeight = Math.max(seeded, innerHeight);

  const covered = Math.max(0, Math.round(innerHeight - vvHeight - vvOffsetTop));
  const shrunk = Math.max(0, restHeight - innerHeight);
  const strip = covered > KEYBOARD_MIN_PX || shrunk > KEYBOARD_MIN_PX;

  // A latch, in both directions, and both directions matter.
  //
  // It can only RAISE while an editable has focus — so a stale `restHeight`
  // alone can never claim a keyboard, which is what used to leave `--kb-open`
  // stuck at 1 for a whole session after a rotation.
  //
  // It only DROPS when the geometry says the strip is gone — so blurring the
  // input to tap "send" does not yank the padding away and drop the composer
  // behind the keys for the frame before it closes.
  const kbOpen = (editableFocused && strip) || (wasOpen && strip);

  return {
    snapshot: {
      kbInset: covered,
      kbOpen,
      vvHeight: Math.round(vvHeight),
      vvTop: Math.round(vvOffsetTop),
    },
    restHeight,
  };
}
