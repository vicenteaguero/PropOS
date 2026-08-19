/**
 * Version gate: the bundle this tab is running must match what the server serves.
 *
 * `registerType: "autoUpdate"` on its own does not guarantee that. It swaps the
 * service worker's precache in the background, but a tab that never navigates
 * keeps executing the JS it booted with — and an installed PWA is resumed, not
 * reloaded, so that tab can be days old. The previous `confirm()` prompt made it
 * worse by offering a "no": a client that stays behind keeps calling an API that
 * has already moved.
 *
 * So the build stamps `/version.json` with the same commit that is baked into the
 * bundle (`VITE_APP_VERSION`), and the client compares the two. They disagree
 * only when the server has shipped a new build under this tab.
 */

export const BUILD_VERSION: string = import.meta.env.VITE_APP_VERSION ?? "dev";

const MANIFEST_URL = "/version.json";
const ATTEMPT_KEY = "propos:update-attempt";

/**
 * A reload only helps if it actually lands on the new bundle. When a CDN has not
 * finished propagating, `version.json` already advertises the new commit while
 * the HTML still resolves to the old one — reloading on every check would spin
 * forever. Give up after this many tries for the same target and let the user
 * keep working; the next tab (or the next check after propagation) retries.
 */
const MAX_ATTEMPTS = 2;

/** Long enough for a new worker to take control, short enough not to strand the overlay. */
const CONTROLLER_TIMEOUT_MS = 4000;

/**
 * Hard ceiling on the whole update path. `registration.update()` goes to the
 * network and can hang there indefinitely on a flaky connection — and a loader
 * that never resolves is worse than a tab that never updated, because the user
 * cannot even keep working. Whatever the service worker is doing, reload by then.
 */
const UPDATE_DEADLINE_MS = 5000;

/** Read the commit the server is currently serving. `null` means "don't know". */
export async function fetchDeployedVersion(signal?: AbortSignal): Promise<string | null> {
  try {
    // Cache-busted *and* `no-store`: belt and braces against an edge or a
    // service worker that decides to hold onto this file.
    const res = await fetch(`${MANIFEST_URL}?t=${Date.now()}`, { cache: "no-store", signal });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    const version = (data as { version?: unknown }).version;
    return typeof version === "string" && version.length > 0 ? version : null;
  } catch {
    // Offline, or a deploy caught mid-flight. Staying on the current bundle is
    // always better than reacting to a failed probe.
    return null;
  }
}

/** True when the server has moved on from what this tab is running. */
export function isStale(deployed: string | null): boolean {
  return deployed !== null && deployed !== BUILD_VERSION;
}

function readAttempts(target: string): number {
  try {
    const raw = sessionStorage.getItem(ATTEMPT_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { target?: unknown; count?: unknown };
    if (parsed.target !== target || typeof parsed.count !== "number") return 0;
    return parsed.count;
  } catch {
    // Private-mode Safari throws on access, and a hand-edited value throws on
    // parse. Either way: no history, so the next attempt is the first.
    return 0;
  }
}

export function canAttempt(target: string): boolean {
  return readAttempts(target) < MAX_ATTEMPTS;
}

export function recordAttempt(target: string): void {
  try {
    sessionStorage.setItem(
      ATTEMPT_KEY,
      JSON.stringify({ target, count: readAttempts(target) + 1 }),
    );
  } catch {
    // Storage unavailable. The guard degrades to "always allow", which is the
    // safe direction: updating too eagerly beats being stuck on a stale build.
  }
}

/** Called once the running bundle matches again, so a later deploy starts clean. */
export function clearAttempts(): void {
  try {
    sessionStorage.removeItem(ATTEMPT_KEY);
  } catch {
    // ignore — see recordAttempt
  }
}

/** Pull the new service worker into control, then reload onto the new bundle. */
export async function applyUpdate(): Promise<void> {
  // Every path below ends in a reload, and several can race — a controllerchange
  // and the deadline can both fire. Reloading twice would throw away the second
  // navigation, so the first one wins.
  let reloaded = false;
  const reload = () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  };

  window.setTimeout(reload, UPDATE_DEADLINE_MS);

  if (!("serviceWorker" in navigator)) {
    reload();
    return;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      reload();
      return;
    }

    await registration.update();

    // `skipWaiting: true` in the workbox config means a new worker normally
    // activates by itself, so `waiting` is usually empty. Handle it anyway:
    // if that option is ever turned off, the new worker would sit here forever
    // and the gate would reload straight back onto the old bundle.
    const { waiting } = registration;
    if (waiting) {
      navigator.serviceWorker.addEventListener("controllerchange", reload, { once: true });
      waiting.postMessage({ type: "SKIP_WAITING" });
      window.setTimeout(reload, CONTROLLER_TIMEOUT_MS);
      return;
    }

    reload();
  } catch {
    reload();
  }
}

/**
 * Lets the service-worker registration in `main.tsx` raise the same overlay the
 * poll raises, without importing React or reaching into component state.
 */
type UpdateListener = () => void;
let updateListener: UpdateListener | null = null;

export function onUpdateRequested(listener: UpdateListener | null): void {
  updateListener = listener;
}

export function requestUpdate(): void {
  updateListener?.();
}
