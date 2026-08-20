/**
 * One microphone capture per session, shared by every recorder.
 *
 * Each recording used to call `getUserMedia` fresh and stop every track when it
 * ended. On desktop Chrome that is invisible — the grant is remembered per
 * origin. On an iOS Safari tab it is not: the permission there lives with the
 * capture, so tearing the stream down means the next recording prompts again,
 * which is why the app appeared to ask on every use.
 *
 * Holding the stream open instead means at most one prompt per session. The cost
 * is the OS recording indicator, so the stream is not held indefinitely: it is
 * released after a period of no recording, and immediately when the page is
 * hidden. Nothing here can extend a grant beyond what the browser allows — see
 * `permissionHint` for the part the user has to do.
 */

/** Long enough to cover "record, listen back, record again", short enough not to squat on the mic. */
const IDLE_RELEASE_MS = 60_000;

/**
 * Remembers that this browser granted the mic at least once. Only consulted
 * where the Permissions API cannot answer (Safari), so it is a hint, never an
 * authority: `getUserMedia` still decides.
 */
const GRANT_FLAG = "propos:mic-granted";

function rememberGrant(): void {
  try {
    window.localStorage.setItem(GRANT_FLAG, "1");
  } catch {
    // Private mode / storage disabled — auto-start just stays off.
  }
}

function forgetGrant(): void {
  try {
    window.localStorage.removeItem(GRANT_FLAG);
  } catch {
    // ignored, same reason
  }
}

function hasRememberedGrant(): boolean {
  try {
    return window.localStorage.getItem(GRANT_FLAG) === "1";
  } catch {
    return false;
  }
}

/**
 * iOS Safari outside an installed app: the grant lives with the capture and is
 * gone the moment the page reloads, so a remembered grant means nothing there.
 */
function isIosTabWithoutInstall(): boolean {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  if (!/iPad|iPhone|iPod/.test(ua)) return false;
  const installed =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as { standalone?: boolean }).standalone === true);
  return !installed;
}

let cached: MediaStream | null = null;
let releaseTimer: ReturnType<typeof setTimeout> | null = null;
let pageHideBound = false;

function isUsable(stream: MediaStream | null): stream is MediaStream {
  // A track goes "ended" when the device is unplugged, the OS reclaims it, or
  // the user revokes the grant mid-session. Reusing it would fail silently.
  return stream !== null && stream.getAudioTracks().some((t) => t.readyState === "live");
}

function stopNow(): void {
  cached?.getTracks().forEach((t) => t.stop());
  cached = null;
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
  // Backgrounding the app must drop the mic — leaving the indicator on after the
  // user has switched away reads as the app listening in the background.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      cancelRelease();
      stopNow();
    }
  });
}

/** The shared capture, prompting only if there is nothing usable to reuse. */
export async function acquireMicStream(): Promise<MediaStream> {
  bindPageHide();
  cancelRelease();

  if (isUsable(cached)) return cached;

  stopNow(); // clear a dead stream before asking for a new one
  try {
    cached = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    // A refusal invalidates the remembered grant; otherwise a user who revoked
    // the mic would keep getting an unwanted prompt on every open.
    if (err instanceof Error && (err.name === "NotAllowedError" || err.name === "SecurityError")) {
      forgetGrant();
    }
    throw err;
  }
  rememberGrant();
  return cached;
}

/**
 * Called when a recording ends. Keeps the capture alive briefly so the next one
 * does not re-prompt, then lets it go.
 */
export function releaseMicStream({ immediate = false } = {}): void {
  cancelRelease();
  if (immediate) {
    stopNow();
    return;
  }
  releaseTimer = setTimeout(stopNow, IDLE_RELEASE_MS);
}

/** True when a capture can be reused without prompting. */
export function hasLiveMicStream(): boolean {
  return isUsable(cached);
}

/**
 * Whether the mic may be opened without a tap — i.e. whether doing so can be
 * counted on not to raise a permission dialog.
 *
 * A live capture is the certain case. Beyond it, `permissions.query` answers on
 * Chromium and Firefox. Safari answers "unknown", which is why this used to
 * require a live stream and, as a result, never auto-started from a cold open:
 * the shared capture is dropped after a minute idle and whenever the page is
 * hidden, so arriving at Propo from the home screen always failed the check.
 * There, a grant remembered from a previous session stands in — except in an
 * iOS tab, where the grant does not survive and the prompt would come back.
 */
export async function canAutoStartMic(): Promise<boolean> {
  if (isUsable(cached)) return true;
  const state = await micPermissionState();
  if (state === "granted") return true;
  if (state === "unknown") return hasRememberedGrant() && !isIosTabWithoutInstall();
  return false;
}

/** Test seam — drops the shared capture and any pending release. */
export function resetMicStream(): void {
  cancelRelease();
  stopNow();
  forgetGrant();
}

export type MicPermissionState = "granted" | "denied" | "prompt" | "unknown";

/**
 * What the browser will do on the next request, when it will say. Safari does not
 * implement `permissions.query` for microphone, so "unknown" is a normal answer
 * and callers must still handle a rejected `getUserMedia`.
 */
export async function micPermissionState(): Promise<MicPermissionState> {
  try {
    if (!navigator.permissions?.query) return "unknown";
    const status = await navigator.permissions.query({
      name: "microphone" as PermissionName,
    });
    return status.state;
  } catch {
    return "unknown";
  }
}

/**
 * The honest instruction for a denied mic, which differs by platform: iOS only
 * remembers the grant for an installed app, so telling a Safari-tab user to dig
 * through settings sends them somewhere that will not stick.
 */
export function permissionHint(): string {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua);
  const installed =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as { standalone?: boolean }).standalone === true);

  if (isIos && !installed) {
    return "Permiso de micrófono denegado. En iPhone el permiso solo queda guardado si instalas PropOS: toca Compartir → Agregar a inicio, y ábrela desde ahí.";
  }
  if (isIos) {
    return "Permiso de micrófono denegado. Abre Ajustes → PropOS → Micrófono → Permitir.";
  }
  return "Permiso de micrófono denegado. Habilítalo en la configuración del navegador y vuelve a intentar.";
}
