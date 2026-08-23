import {
  computeSnapshot,
  isEditableElement,
  sameSnapshot,
  type ViewportSnapshot,
} from "./viewport-vars";

/**
 * One subscriber to `visualViewport` for the whole app, with a refcount.
 *
 * This replaced a hook that each surface ran its own copy of. Four CSS custom
 * properties (`--kb-inset`, `--kb-open`, `--vv-h`, `--vv-top`) live on <html>,
 * and every copy of the hook removed all four on unmount — so closing Propo
 * over an open WhatsApp thread wiped the variables out from under the thread,
 * `.fixed-vv` fell back to `top:0; height:100dvh` with the keyboard still up,
 * and the composer ended up behind the keys with the page showing through.
 *
 * A module singleton rather than a React provider, for two reasons. The
 * keyboard animation fires ~30 resize/scroll events, and a provider would
 * re-render the whole tree on each one; and the Propo overlay is portalled to
 * `document.body` from a provider that degrades to a no-op when absent, so a
 * context would have missed exactly the surface this bug lives on.
 *
 * Geometry is written straight to CSS — no React render at all. Subscribers are
 * notified only when the `kbOpen` boolean actually flips.
 */

const EMPTY: ViewportSnapshot = { kbInset: 0, kbOpen: false, vvHeight: 0, vvTop: 0 };

let refs = 0;
let restHeight = 0;
let current: ViewportSnapshot = EMPTY;
const subscribers = new Set<() => void>();

function root(): HTMLElement | null {
  return typeof document === "undefined" ? null : document.documentElement;
}

function write(snapshot: ViewportSnapshot): void {
  const el = root();
  if (!el) return;
  // Only on change: a sub-pixel churn on a custom property repaints the subtree,
  // and iOS reports fractional values continuously mid-animation.
  const set = (name: string, value: string) => {
    if (el.style.getPropertyValue(name) !== value) el.style.setProperty(name, value);
  };
  set("--kb-inset", `${snapshot.kbInset}px`);
  set("--kb-open", snapshot.kbOpen ? "1" : "0");
  set("--vv-h", `${snapshot.vvHeight}px`);
  set("--vv-top", `${snapshot.vvTop}px`);
}

function clear(): void {
  const el = root();
  if (!el) return;
  el.style.removeProperty("--kb-inset");
  el.style.removeProperty("--kb-open");
  el.style.removeProperty("--vv-h");
  el.style.removeProperty("--vv-top");
}

function read(): void {
  const vv = typeof window === "undefined" ? undefined : window.visualViewport;
  if (!vv) return;
  const wasOpen = current.kbOpen;
  const next = computeSnapshot({
    reading: {
      innerHeight: window.innerHeight,
      vvHeight: vv.height,
      vvOffsetTop: vv.offsetTop,
    },
    restHeight,
    editableFocused: isEditableElement(document.activeElement),
    wasOpen,
  });
  restHeight = next.restHeight;
  if (sameSnapshot(current, next.snapshot)) return;
  current = next.snapshot;
  write(current);
  // Only the boolean drives React. The geometry is CSS-only by design.
  if (wasOpen !== current.kbOpen) subscribers.forEach((fn) => fn());
}

function onRotate(): void {
  // A portrait restHeight measured against a landscape innerHeight looks like a
  // 450px keyboard, which used to pin `--kb-open` at 1 for the rest of the
  // session. Forget it and re-measure on the resize that follows.
  restHeight = 0;
  read();
}

// One eager read at import, without listeners. Without it `.fixed-vv` falls back
// to `height: 100dvh` for the first frame — and on iOS `100dvh` is the LARGE
// viewport, i.e. taller than what is actually visible.
if (typeof window !== "undefined" && window.visualViewport) read();

export function subscribeViewport(onChange: () => void): () => void {
  subscribers.add(onChange);
  refs += 1;
  const vv = typeof window === "undefined" ? undefined : window.visualViewport;
  if (refs === 1 && vv) {
    vv.addEventListener("resize", read);
    vv.addEventListener("scroll", read);
    window.addEventListener("orientationchange", onRotate);
    read();
  }
  return () => {
    subscribers.delete(onChange);
    refs = Math.max(0, refs - 1);
    // Only the LAST consumer tears down. This is the whole point of the module.
    if (refs === 0 && vv) {
      vv.removeEventListener("resize", read);
      vv.removeEventListener("scroll", read);
      window.removeEventListener("orientationchange", onRotate);
      current = EMPTY;
      clear();
    }
  };
}

export function getViewportSnapshot(): ViewportSnapshot {
  return current;
}

/** Test seam. Not for application code. */
export function __resetViewportStore(): void {
  subscribers.clear();
  refs = 0;
  restHeight = 0;
  current = EMPTY;
  clear();
}
