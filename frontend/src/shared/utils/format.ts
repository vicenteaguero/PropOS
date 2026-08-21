/**
 * Shared display formatters.
 *
 * Each of these existed as a private copy in several feature files — `initials`
 * nine times, the CLP formatter six, the date formatter nine — which is how the
 * same list ended up showing "12 ago 2026, 14:30" on one screen and
 * "12-08-2026, 14:30" on the next, and how a null name crashed one avatar while
 * another rendered "?".
 *
 * Currency lives in ./currency (`formatClp`, cents in). Note `@/lib/locale-cl`
 * also exports `formatCLP`, which takes WHOLE PESOS and belongs to the agent's
 * transcript parsing — a genuinely different contract, not a duplicate.
 */

/** "Vicente Agüero" → "VA". Null-safe; returns "?" when there's no name. */
export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const letters = name
    .trim()
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return letters || "?";
}

/** Anything a caller might hold: an ISO string, epoch ms, or a Date. */
export type DateLike = string | number | Date | null | undefined;

function safeDate(ts: DateLike): Date | null {
  if (ts === null || ts === undefined || ts === "") return null;
  const d = ts instanceof Date ? ts : new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * The clock, once.
 *
 * `timeStyle: "short"` on es-CL renders "10:30 a. m." — a twelve-hour clock with
 * four characters of trailing punctuation, in a country that writes 10:30. It
 * also disagreed with the conversation list and the message bubbles, which set
 * their own 24-hour formatters, so the same instant read two ways one screen
 * apart.
 *
 * Spelled out part by part rather than via `timeStyle`, because `dateStyle` and
 * `timeStyle` cannot be combined with individual component options — mixing
 * them throws `Invalid option : option` at runtime, on every timestamp in the
 * app. es-CL renders these exactly as `medium`/`short` did.
 */
const CLOCK = { hour: "2-digit", minute: "2-digit", hour12: false } as const;
const DATE_FULL = { day: "2-digit", month: "2-digit", year: "numeric" } as const;
const DATE_SHORT = { day: "2-digit", month: "2-digit", year: "2-digit" } as const;

/** "12-08-2026, 10:30" — the default for timestamps in lists and detail rows. */
export function formatDateTime(ts: DateLike, fallback = ""): string {
  const d = safeDate(ts);
  return d ? d.toLocaleString("es-CL", { ...DATE_FULL, ...CLOCK }) : fallback;
}

/** "12-08-26, 10:30" — two-digit year, for dense rows. */
export function formatShortDateTime(ts: DateLike, fallback = ""): string {
  const d = safeDate(ts);
  return d ? d.toLocaleString("es-CL", { ...DATE_SHORT, ...CLOCK }) : fallback;
}

/** "12 ago" — for compact cards where the year is noise. */
export function formatDayMonth(ts: DateLike, fallback = ""): string {
  const d = safeDate(ts);
  return d ? d.toLocaleDateString("es-CL", { day: "numeric", month: "short" }) : fallback;
}

/** "12-08-2026" — date only. */
export function formatDate(ts: DateLike, fallback = ""): string {
  const d = safeDate(ts);
  return d ? d.toLocaleDateString("es-CL") : fallback;
}
