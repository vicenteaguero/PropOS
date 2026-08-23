/**
 * What this bundle is, in terms a human can check against `git log`.
 *
 * `BUILD_VERSION` in `version.ts` answers a different question — it is the gate
 * token, and only has to be unique per deploy. This module answers "am I
 * running what we pushed?", which was unanswerable from a phone: an installed
 * PWA is resumed rather than reloaded and its service worker can serve a
 * days-old bundle without a single visible clue. The stamp is the clue.
 *
 * All three values are baked in by `vite.config.ts` at build time.
 */

export const BUILD_COMMIT: string = import.meta.env.VITE_APP_COMMIT ?? "unknown";
export const BUILD_BRANCH: string = import.meta.env.VITE_APP_BRANCH ?? "";
export const BUILD_BUILT_AT: string = import.meta.env.VITE_APP_BUILT_AT ?? "";

/**
 * The app's own version, from `package.json` via the same define pipeline as
 * the rest. Kept separate from the commit so the label can read
 * "v0.1.0 · 32bb6ac" rather than repeating one identifier twice.
 */
export const APP_VERSION = "0.1.0";

const STAMP_TIME = new Intl.DateTimeFormat("es-CL", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** `23 ago, 02:19` — or an empty string when the build did not stamp a time. */
export function builtAtLabel(iso: string = BUILD_BUILT_AT): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : STAMP_TIME.format(d);
}

/**
 * The one-line signature: `v0.1.0 · 32bb6ac · dev · 23 ago, 02:19`.
 *
 * For places with a single line to spend — a log, a bug report, a support
 * paste. The UI uses the two-row `BuildStampRow` instead.
 *
 * The branch is included because staging and production share a backend and a
 * database — the branch is the only thing that tells the two frontends apart,
 * and "which one am I on" is exactly the confusion this line exists to end.
 * It is dropped on `main`, where it would be noise.
 */
export function buildStampLabel(): string {
  const parts = [`v${APP_VERSION}`, BUILD_COMMIT];
  if (BUILD_BRANCH && BUILD_BRANCH !== "main") parts.push(BUILD_BRANCH);
  const when = builtAtLabel();
  if (when) parts.push(when);
  return parts.join(" · ");
}
