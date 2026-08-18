/**
 * Row actions that stay out of the way until the row is engaged.
 *
 * The naive spelling — `opacity-0 group-hover:opacity-100` — hides the control
 * from two whole input classes:
 *
 *   - touch, where `:hover` never fires, so the action is permanently invisible
 *     (this app is driven mostly from a phone, so that's the majority case);
 *   - keyboard, where the button takes focus but stays at `opacity: 0`, leaving
 *     the user tabbing onto something they cannot see.
 *
 * `[@media(hover:hover)]` scopes the hiding to pointers that can actually
 * hover, and `focus-visible:` brings it back for keyboard users. Pair with
 * `group` on the row and an `aria-label` on the control.
 */
export const HOVER_REVEAL =
  "[@media(hover:hover)]:opacity-0 transition-opacity " +
  "group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100";
