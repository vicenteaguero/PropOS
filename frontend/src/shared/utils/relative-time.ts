/**
 * WhatsApp-style timestamps for conversation lists.
 *
 * A list of 145 threads all reading "20-08-26, 6:21 p. m." is unreadable: every
 * row looks the same and the eye has to parse a date to learn "this one is from
 * this morning". Recency is the only thing a broker scans an inbox for, so the
 * format collapses as it ages — a time today, a weekday this week, a date after
 * that — exactly the way the messaging apps they already use behave.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const TIME = new Intl.DateTimeFormat("es-CL", { hour: "numeric", minute: "2-digit" });
const WEEKDAY = new Intl.DateTimeFormat("es-CL", { weekday: "long" });
const DAY_MONTH = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short" });
const FULL = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", year: "numeric" });

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Compact list timestamp: `14:30` · `Ayer` · `Lunes` · `4 ago` · `4 ago 2025`.
 *
 * `now` is injectable so the boundaries can be tested without freezing time.
 */
export function listTime(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";

  const days = Math.round((startOfDay(now) - startOfDay(d)) / DAY_MS);
  if (days <= 0) return TIME.format(d);
  if (days === 1) return "Ayer";
  // Inside the last week a weekday is more legible than a date — "Lunes" needs
  // no arithmetic, "18 ago" does.
  if (days < 7) return cap(WEEKDAY.format(d));
  if (d.getFullYear() === now.getFullYear()) return DAY_MONTH.format(d);
  return FULL.format(d);
}

/**
 * Elapsed time in words: `Hace 4h`, `Hace 3 d`. For activity feeds, where the
 * question is "how long ago", not "when".
 */
export function timeAgo(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";

  const seconds = Math.max(0, Math.round((now.getTime() - d.getTime()) / 1000));
  if (seconds < 60) return "Recién";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `Hace ${days} d`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `Hace ${weeks} sem`;
  const months = Math.round(days / 30);
  if (months < 12) return `Hace ${months} mes${months === 1 ? "" : "es"}`;
  const years = Math.round(days / 365);
  return `Hace ${years} año${years === 1 ? "" : "s"}`;
}

/**
 * The same delay, mid-sentence: "Último contacto hace 3 h".
 *
 * `timeAgo` is written for a standalone slot, so it capitalises. Dropping that
 * capital at the call site is one `toLowerCase()` away, but "Recién" must stay
 * capitalised nowhere and lowercase everywhere it follows other words.
 */
export function timeAgoInline(iso: string | null | undefined, now: Date = new Date()): string {
  const text = timeAgo(iso, now);
  return text ? text.charAt(0).toLowerCase() + text.slice(1) : "";
}
