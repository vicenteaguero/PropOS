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
    const update = () => {
      // Rounded because iOS reports fractional values mid-animation and a
      // sub-pixel churn on a custom property repaints the whole subtree.
      const covered = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      root.style.setProperty("--kb-inset", `${covered}px`);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      root.style.removeProperty("--kb-inset");
    };
  }, []);
}
