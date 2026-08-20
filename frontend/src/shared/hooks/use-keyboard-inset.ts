import { useEffect } from "react";

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
 * Call once, high in the tree. Surfaces consume it as
 * `pb-[calc(var(--kb-inset,0px)+…)]` and should drop their `--safe-bottom`
 * padding while it is non-zero: the home indicator is under the keyboard.
 */
export function useKeyboardInset() {
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
      root.style.setProperty("--kb-open", covered > 80 || shrunk > 80 ? "1" : "0");
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      root.style.removeProperty("--kb-inset");
      root.style.removeProperty("--kb-open");
    };
  }, []);
}
