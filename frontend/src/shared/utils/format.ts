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

function safeDate(ts: string | null | undefined): Date | null {
  if (!ts) return null;
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "12-08-2026, 10:30 a. m." — the default for timestamps in lists and detail rows. */
export function formatDateTime(ts: string | null | undefined, fallback = ""): string {
  const d = safeDate(ts);
  return d ? d.toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" }) : fallback;
}

/** "12-08-26, 10:30 a. m." — two-digit year, for dense rows. */
export function formatShortDateTime(ts: string | null | undefined, fallback = ""): string {
  const d = safeDate(ts);
  return d ? d.toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" }) : fallback;
}

/** "12 ago" — for compact cards where the year is noise. */
export function formatDayMonth(ts: string | null | undefined, fallback = ""): string {
  const d = safeDate(ts);
  return d ? d.toLocaleDateString("es-CL", { day: "numeric", month: "short" }) : fallback;
}

/** "12-08-2026" — date only. */
export function formatDate(ts: string | null | undefined, fallback = ""): string {
  const d = safeDate(ts);
  return d ? d.toLocaleDateString("es-CL") : fallback;
}
