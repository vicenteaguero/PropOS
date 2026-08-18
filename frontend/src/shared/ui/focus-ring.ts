/**
 * The app's one focus indicator, for controls styled outside shadcn's `Input`.
 *
 * Hand-rolled inputs in this codebase reached for `outline-none` and then
 * signalled focus with a 1px border-color change. That reads as decoration, not
 * as an indicator: it fails WCAG 2.4.11 (focus appearance) on contrast and area
 * alike, and on a busy surface it is easy to miss entirely.
 *
 * `focus-visible` rather than `focus` is deliberate and safe here — browsers
 * always match `:focus-visible` on text entry fields regardless of how focus
 * arrived, so a mouse user clicking into a field still gets the ring, while
 * buttons keep it keyboard-only. Mirrors shadcn's `Input` so both look alike.
 */
export const FOCUS_RING =
  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] " +
  "focus-visible:outline-none";
