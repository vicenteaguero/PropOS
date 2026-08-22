/**
 * Minimum tappable size, shared so every surface uses the same number.
 *
 * WCAG 2.5.5 (AAA) and Apple's HIG both put the floor at 44px; Android's is
 * 48dp. The app is a PWA driven mostly from a phone, so 44 is the hard floor
 * for anything a broker taps.
 */

/** 44px, in Tailwind's spacing scale (`11` = 2.75rem = 44px). */
export const TOUCH_TARGET_PX = 44;

/**
 * Forces the element's own box to at least 44×44.
 * Use when the element controls its layout and can grow.
 */
export const TOUCH_TARGET = "min-h-11 min-w-11";

/** Height-only variant, for full-width rows that already span the viewport. */
export const TOUCH_TARGET_ROW = "min-h-11";

/**
 * Expands the *hit* area to 44×44 without changing the painted size, via a
 * centered transparent pseudo-element. Use when the visual dimensions are
 * fixed by the design (small icon buttons, dense toolbars).
 *
 * Caveat: neighbours closer than `44 - size` apart get overlapping hit areas,
 * and the later element in DOM order wins. Prefer `TOUCH_TARGET` when the
 * element can simply grow.
 */
export const TOUCH_TARGET_HIT_AREA =
  "relative after:absolute after:left-1/2 after:top-1/2 after:size-11 " +
  "after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']";

/**
 * The 44px floor, applied only where the pointer is a finger.
 *
 * `TOUCH_TARGET` grows the box unconditionally, which would inflate a dense
 * mouse-driven toolbar for no benefit. These variants gate on
 * `pointer: coarse`, so a laptop renders exactly as before while a phone or
 * tablet gets a target a thumb can actually hit.
 */
export const TOUCH_TARGET_COARSE =
  "[@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11";

/** Height-only variant, for controls that already span enough width. */
export const TOUCH_TARGET_ROW_COARSE = "[@media(pointer:coarse)]:min-h-11";

/**
 * THE height of a control that sits in a list header or a filter row.
 *
 * Before this there were six, all inside one `items-center` row: the search
 * field at 40, an icon button at 36, `size="icon-lg"` at 40, `size="sm"` at 32,
 * a Chip at ~34, the channel switch at 40 — and `FilterSelect`, which carried
 * **no height class at all** and was therefore sized by its 13px text at ~28.
 * That is the "the Filter dropdown isn't the same height as the toggle" report,
 * and it only shows on a mouse: a coarse pointer snaps everything to the 44px
 * floor, which is why the row looks fine on a phone and ragged on a laptop.
 *
 * 40px on a pointer, 44 on a finger. Apply it to every control that shares a
 * header row — not to buttons inside a card or a form, which have their own
 * rhythm.
 */
export const CONTROL_H = "h-10 [@media(pointer:coarse)]:h-11";

/** Square variant, for the round icon controls on the same row. */
export const CONTROL_SQUARE = "size-10 [@media(pointer:coarse)]:size-11";
