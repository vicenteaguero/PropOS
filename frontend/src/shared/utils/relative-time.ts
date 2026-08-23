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

// 24h. `hour: "numeric"` on es-CL yields "6:47 a. m." — eleven characters of
// trailing punctuation in a column six wide, for a country that writes 06:47.
const TIME = new Intl.DateTimeFormat("es-CL", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const WEEKDAY = new Intl.DateTimeFormat("es-CL", { weekday: "long" });
const SHORT_WEEKDAY = new Intl.DateTimeFormat("es-CL", { weekday: "short" });
const LONG_DAY = new Intl.DateTimeFormat("es-CL", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const SPELLED_DATE = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "long" });
const DAY_MONTH = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short" });
const FULL = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", year: "numeric" });

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * When something happened, in words, for a row you read rather than scan.
 *
 * `Recién` · `Hace 12 minutos` · `Hace 6 horas` · `Hoy a las 15:45` ·
 * `Ayer a las 15:45` · `Lunes a las 15:45` · `16 ago` · `19 jul 2025`.
 *
 * This is the single source of date naming in the app. It exists because three
 * screens had grown their own and disagreed: a conversation could print
 * "Domingo" *on a Sunday*, because the old ladder had no "Hoy" branch at all
 * and fell through to a bare weekday for anything 2-6 days old — leaving the
 * reader unable to tell today from last week.
 *
 * 24h and no "a. m.": `hour: "numeric"` on es-CL yields "6:47 a. m.", eleven
 * characters of trailing punctuation for a country that writes 06:47.
 *
 * `now` is injectable so the boundaries can be tested without freezing time.
 */
export function whenLabel(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";

  const ms = now.getTime() - d.getTime();
  const days = Math.round((startOfDay(now) - startOfDay(d)) / DAY_MS);

  // Future (a scheduled event read through the same lens) collapses to the clock.
  if (ms < 0) return days === 0 ? `Hoy a las ${TIME.format(d)}` : dateOrWeekday(d, now, days);

  if (ms < 60_000) return "Recién";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `Hace ${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;

  if (days === 0) {
    const hours = Math.round(ms / 3_600_000);
    // Past ~6 h "hace 9 horas" is arithmetic; the clock time is the useful fact.
    if (hours <= 6) return `Hace ${hours} ${hours === 1 ? "hora" : "horas"}`;
    return `Hoy a las ${TIME.format(d)}`;
  }
  if (days === 1) return `Ayer a las ${TIME.format(d)}`;
  return dateOrWeekday(d, now, days);
}

function dateOrWeekday(d: Date, now: Date, days: number): string {
  // Inside the week a weekday needs no arithmetic; beyond it, it is ambiguous.
  if (Math.abs(days) < 7) return `${cap(WEEKDAY.format(d))} a las ${TIME.format(d)}`;
  if (d.getFullYear() === now.getFullYear()) return DAY_MONTH.format(d);
  return FULL.format(d);
}

/**
 * `whenLabel` mid-sentence: "Próximo evento hoy a las 18:30".
 *
 * Same reason `timeAgoInline` exists — the standalone form capitalises, and a
 * capital in the middle of a sentence reads as a proper noun.
 */
export function whenLabelInline(iso: string | null | undefined, now: Date = new Date()): string {
  const text = whenLabel(iso, now);
  return text ? text.charAt(0).toLocaleLowerCase("es") + text.slice(1) : "";
}

/**
 * A whole day by name: `Hoy` · `Ayer` · `Mañana` · `Lunes, 17 de agosto`.
 *
 * The heading over a group of things, as opposed to `whenLabel`, which names
 * one instant. Three screens had grown their own version of this and only two
 * of them knew about "Ayer".
 */
export function dayLabel(day: Date, now: Date = new Date()): string {
  const diff = Math.round((startOfDay(day) - startOfDay(now)) / DAY_MS);
  if (diff === 0) return "Hoy";
  if (diff === -1) return "Ayer";
  if (diff === 1) return "Mañana";
  return cap(LONG_DAY.format(day));
}

/** `dayLabel` with the date always spelled out: `Hoy, 17 de agosto`. */
export function dayLabelWithDate(day: Date, now: Date = new Date()): string {
  const short = dayLabel(day, now);
  return short === "Hoy" || short === "Ayer" || short === "Mañana"
    ? `${short}, ${SPELLED_DATE.format(day)}`
    : short;
}

/**
 * The same instant, squeezed into a list column: `15:45` · `Ayer` · `Lun`.
 *
 * A column six characters wide cannot hold "Ayer a las 15:45", so this drops
 * the clock rather than the anchor — knowing *which day* matters more than the
 * minute when you are scanning 145 threads.
 */
export function listTime(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";

  const ms = now.getTime() - d.getTime();
  const days = Math.round((startOfDay(now) - startOfDay(d)) / DAY_MS);

  if (days === 0) {
    if (ms >= 0 && ms < 60_000) return "Recién";
    if (ms >= 0 && ms < 3_600_000) return `${Math.round(ms / 60_000)} min`;
    // Same six-hour hinge as `whenLabel`, so a row and its detail never
    // disagree about which side of "recent" the same instant falls on.
    const hours = Math.round(ms / 3_600_000);
    if (ms >= 0 && hours <= 6) return `${hours} h`;
    return TIME.format(d);
  }
  if (days === 1) return "Ayer";
  if (days > 0 && days < 7) return cap(SHORT_WEEKDAY.format(d));
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

/**
 * When something is due, in either direction.
 *
 * `timeAgo` clamps to the past, so a deadline three days out came back as
 * "Recién" — which reads as "just happened" for something that has not
 * happened at all. A due date is the one relative time that regularly points
 * forward, and it needs its own wording.
 */
export function dueText(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "";
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";

  const ms = at.getTime() - now.getTime();
  const days = Math.round(Math.abs(ms) / 86_400_000);
  const overdue = ms < 0;

  if (Math.abs(ms) < 3_600_000) return overdue ? "Vencida" : "Vence ahora";
  if (days === 0) return overdue ? "Venció hoy" : "Vence hoy";
  if (days === 1) return overdue ? "Venció ayer" : "Vence mañana";
  if (days < 7) return overdue ? `Venció hace ${days} días` : `Vence en ${days} días`;

  const weeks = Math.round(days / 7);
  if (weeks < 5) {
    const unit = weeks === 1 ? "semana" : "semanas";
    return overdue ? `Venció hace ${weeks} ${unit}` : `Vence en ${weeks} ${unit}`;
  }
  const months = Math.round(days / 30);
  const unit = months === 1 ? "mes" : "meses";
  return overdue ? `Venció hace ${months} ${unit}` : `Vence en ${months} ${unit}`;
}

/**
 * Time left before a deadline: `Vence en 45 min` · `Vence en 6 h` · `Vencida`.
 *
 * The counterpart of `dueText`, which is written for a task's own wording. This
 * one is for a proposal's window — the thing that decides which of two cards to
 * open first — so it leads with the number and never says "Vence ahora", which
 * reads as "act now" and "already gone" at the same time.
 */
export function timeLeft(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "";
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";

  const ms = at.getTime() - now.getTime();
  if (ms <= 0) return "Vencida";

  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `Vence en ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Vence en ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "Vence mañana" : `Vence en ${days} días`;
}

/** How loud a deadline should be. Drives the card's border, nothing else. */
export function deadlineTone(
  iso: string | null | undefined,
  now: Date = new Date(),
): "danger" | "warn" | "none" {
  if (!iso) return "none";
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "none";
  const hours = (at.getTime() - now.getTime()) / 3_600_000;
  if (hours <= 2) return "danger";
  if (hours <= 6) return "warn";
  return "none";
}
