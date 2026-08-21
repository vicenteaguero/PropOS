import { useEffect, useState } from "react";

/**
 * Publishes the on-screen keyboard's height to `--kb-inset` on <html>.
 *
 * iOS Safari does not resize the layout viewport when the keyboard opens: the
 * page keeps its full height and the keyboard simply covers the bottom of it.
 * A composer pinned with `bottom: 0` therefore ends up *behind* the keyboard,
 * and the safe-area padding it carries for the home indicator is added on top
 * of that — which is the "two kilometres away" gap. `visualViewport` is the
 * only API that reports the covered strip.
 *
 * Also publishes the visual viewport's own box as `--vv-h` / `--vv-top`, for
 * surfaces that must sit ON the visible area rather than on the layout viewport
 * — see `.fixed-vv` in index.css. And returns whether the keyboard is up, which
 * a few surfaces need in JS: suggestions worth showing on an empty chat are
 * worth hiding the moment there is a keyboard covering half the screen.
 *
 * Call once per surface. Surfaces consume the inset as
 * `pb-[calc(var(--kb-inset,0px)+…)]` and should drop their `--safe-bottom`
 * padding while it is non-zero: the home indicator is under the keyboard.
 */
export function useKeyboardInset(): { open: boolean } {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    // The tallest layout viewport we have seen. `interactive-widget=resizes-content`
    // (index.html) makes the LAYOUT viewport shrink when the keyboard opens, so on
    // those platforms `innerHeight - vv.height` is ~0 and the keyboard is
    // invisible to the formula below. Comparing against the tallest height we
    // have observed catches that case.
    let restHeight = window.innerHeight;

    const update = () => {
      restHeight = Math.max(restHeight, window.innerHeight);
      // Rounded because iOS reports fractional values mid-animation and a
      // sub-pixel churn on a custom property repaints the whole subtree.
      const covered = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      const shrunk = Math.max(0, restHeight - window.innerHeight);
      root.style.setProperty("--kb-inset", `${covered}px`);
      // A boolean, because the height alone cannot tell the two platforms apart:
      // one reports the covered strip, the other has already removed it. Without
      // it the composer kept its home-indicator padding while sitting ON the
      // keyboard — ~46px of dead air.
      const isOpen = covered > 80 || shrunk > 80;
      root.style.setProperty("--kb-open", isOpen ? "1" : "0");
      setOpen(isOpen);
      // The visible box itself. On iOS a `position: fixed` element is laid out
      // against the LAYOUT viewport, which the keyboard does not change — so
      // focusing an input scrolls the visual viewport and carries the whole
      // surface, header included, up off the screen. Pinning to these two
      // numbers is the only way a full-screen surface stays put.
      root.style.setProperty("--vv-h", `${Math.round(vv.height)}px`);
      root.style.setProperty("--vv-top", `${Math.round(vv.offsetTop)}px`);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      root.style.removeProperty("--kb-inset");
      root.style.removeProperty("--kb-open");
      root.style.removeProperty("--vv-h");
      root.style.removeProperty("--vv-top");
    };
  }, []);

  return { open };
}
