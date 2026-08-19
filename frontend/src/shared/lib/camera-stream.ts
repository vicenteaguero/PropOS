/**
 * One camera capture per session, shared across routes.
 *
 * WebKit does not persist a camera grant for an installed web app: in standalone
 * mode the permission is scoped to the capture, and an SPA route change or reload
 * revokes it, so the next `getUserMedia` prompts again (webkit.org/b/215884).
 * Installing the PWA does not fix this and in standalone it is worse than a plain
 * Safari tab.
 *
 * The workaround Apple's own forums land on is to hold one stream open across
 * routes instead of re-acquiring per screen, which is what this does. It cannot
 * survive a reload — nothing in the page can — so the honest ceiling is one
 * prompt per app session.
 *
 * Mirrors `mic-stream.ts`; kept separate because the camera takes constraints and
 * a change of lens or resolution genuinely needs a new capture.
 */

/** Long enough to cover "scan, review, scan again", short enough not to hold the lens. */
const IDLE_RELEASE_MS = 60_000;

export interface CameraConstraints {
  facingMode?: "user" | "environment";
  width?: number;
  height?: number;
  /** Passed through untouched; only its presence affects the cache signature. */
  advanced?: MediaTrackConstraintSet[];
}

let cached: MediaStream | null = null;
let cachedKey = "";
let releaseTimer: ReturnType<typeof setTimeout> | null = null;
let pageHideBound = false;

/** Two requests share a capture only when they want the same lens and size. */
function signature(c: CameraConstraints): string {
  return JSON.stringify([c.facingMode ?? "environment", c.width ?? 0, c.height ?? 0, !!c.advanced]);
}

function isUsable(stream: MediaStream | null): stream is MediaStream {
  return stream !== null && stream.getVideoTracks().some((t) => t.readyState === "live");
}

function stopNow(): void {
  cached?.getTracks().forEach((t) => t.stop());
  cached = null;
  cachedKey = "";
}

function cancelRelease(): void {
  if (releaseTimer !== null) {
    clearTimeout(releaseTimer);
    releaseTimer = null;
  }
}

function bindPageHide(): void {
  if (pageHideBound || typeof document === "undefined") return;
  pageHideBound = true;
  // Never hold the lens while the app is in the background — the OS indicator
  // stays lit and reads as the app watching after the user switched away.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      cancelRelease();
      stopNow();
    }
  });
}

/** The shared capture, prompting only when there is nothing matching to reuse. */
export async function acquireCameraStream(
  constraints: CameraConstraints = {},
): Promise<MediaStream> {
  bindPageHide();
  cancelRelease();

  const key = signature(constraints);
  if (key === cachedKey && isUsable(cached)) return cached;

  stopNow();
  cached = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: constraints.facingMode ? { ideal: constraints.facingMode } : undefined,
      width: constraints.width ? { ideal: constraints.width } : undefined,
      height: constraints.height ? { ideal: constraints.height } : undefined,
      advanced: constraints.advanced,
    },
    audio: false,
  });
  cachedKey = key;
  return cached;
}

/** Called when a viewfinder closes. Holds the capture briefly so the next open is silent. */
export function releaseCameraStream({ immediate = false } = {}): void {
  cancelRelease();
  if (immediate) {
    stopNow();
    return;
  }
  releaseTimer = setTimeout(stopNow, IDLE_RELEASE_MS);
}

/** True when a capture can be reused without prompting. */
export function hasLiveCameraStream(): boolean {
  return isUsable(cached);
}

/** Test seam — drops the shared capture and any pending release. */
export function resetCameraStream(): void {
  cancelRelease();
  stopNow();
}
