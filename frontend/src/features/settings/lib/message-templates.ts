/**
 * The bit of a WhatsApp template that is genuinely hard to see: which name
 * fills which slot.
 *
 * Meta substitutes by POSITION. The body says `{{1}}`, we store an ordered
 * array of names, and `variables[0]` is what goes into `{{1}}`. Nothing in
 * either representation shows the correspondence, so a screen that prints the
 * body and the array side by side leaves the reader counting braces. These
 * helpers turn the pair into segments that can be rendered with the name in
 * the slot's place.
 */

export type ApprovalStatus = "draft" | "submitted" | "approved" | "rejected";
export type TemplateChannel = "whatsapp" | "email";
export type TemplateCategory = "utility" | "marketing" | "authentication";

export interface MessageTemplate {
  id: string;
  name: string;
  channel: TemplateChannel;
  category: TemplateCategory;
  language: string;
  body: string;
  variables: string[];
  external_name: string | null;
  approval_status: ApprovalStatus;
  approved_at: string | null;
  updated_at: string | null;
}

export type BodySegment =
  | { kind: "text"; text: string }
  | { kind: "slot"; index: number; name: string | null };

const PLACEHOLDER = /\{\{\s*(\d+)\s*\}\}/g;

/** Slot indices present in a body, ascending and deduplicated. */
export function slotsIn(body: string): number[] {
  const found = new Set<number>();
  for (const match of body.matchAll(PLACEHOLDER)) found.add(Number(match[1]));
  return [...found].sort((a, b) => a - b);
}

/**
 * Splits a body into literal text and slots, each slot already carrying the
 * name it is filled with — `null` when the array is short, which is the state
 * the editor has to warn about.
 */
export function segmentBody(body: string, variables: string[]): BodySegment[] {
  const segments: BodySegment[] = [];
  let cursor = 0;
  for (const match of body.matchAll(PLACEHOLDER)) {
    const at = match.index ?? 0;
    if (at > cursor) segments.push({ kind: "text", text: body.slice(cursor, at) });
    const index = Number(match[1]);
    segments.push({ kind: "slot", index, name: variables[index - 1]?.trim() || null });
    cursor = at + match[0].length;
  }
  if (cursor < body.length) segments.push({ kind: "text", text: body.slice(cursor) });
  return segments;
}

/**
 * Keeps the name array the same length as the body's slots.
 *
 * The two can only disagree by accident: a slot with no name sends an empty
 * string to a customer, and a name with no slot is never sent at all. Deriving
 * the array from the body on every keystroke means the mismatch cannot be
 * typed in the first place, so the server's 422 stays a backstop.
 */
export function syncVariables(body: string, variables: string[]): string[] {
  const count = slotsIn(body).length;
  return Array.from({ length: count }, (_, i) => variables[i] ?? "");
}

/** The next placeholder to append, i.e. one past the highest slot in use. */
export function nextSlot(body: string): number {
  return slotsIn(body).length + 1;
}

/**
 * The reason a template cannot be saved, in Spanish, or null when it can.
 *
 * Mirrors `settings/service.validate_variables` on purpose: the same rule
 * stated at the field the user is typing in, rather than as a toast after a
 * round trip.
 */
export function templateIssue(name: string, body: string, variables: string[]): string | null {
  if (!name.trim()) return "Ponle un nombre.";
  if (!body.trim()) return "Escribe el mensaje.";
  const slots = slotsIn(body);
  const contiguous = slots.every((slot, i) => slot === i + 1);
  if (!contiguous) {
    return `Las variables deben ir de {{1}} en adelante sin saltarse ninguna. Hay ${slots.join(", ")}.`;
  }
  const missing = slots.filter((slot) => !variables[slot - 1]?.trim());
  if (missing.length > 0) {
    return `Falta el nombre de ${missing.map((s) => `{{${s}}}`).join(", ")}.`;
  }
  const named = variables.slice(0, slots.length).map((v) => v.trim());
  if (new Set(named).size !== named.length) return "Hay dos variables con el mismo nombre.";
  return null;
}

/** Only an approved template survives outside the 24 h service window. */
export function isSendable(template: MessageTemplate): boolean {
  return template.approval_status === "approved";
}

/**
 * Sendable first, then the ones waiting on Meta, then the ones that need work.
 *
 * The default alphabetical order buries the only question the page answers —
 * "what can I actually send right now" — under whatever the templates happen
 * to be called.
 */
const STATUS_RANK: Record<ApprovalStatus, number> = {
  approved: 0,
  submitted: 1,
  rejected: 2,
  draft: 3,
};

export function sortTemplates(templates: MessageTemplate[]): MessageTemplate[] {
  return [...templates].sort(
    (a, b) =>
      STATUS_RANK[a.approval_status] - STATUS_RANK[b.approval_status] ||
      a.name.localeCompare(b.name, "es"),
  );
}

export function matchesQuery(template: MessageTemplate, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    template.name.toLowerCase().includes(q) ||
    template.body.toLowerCase().includes(q) ||
    template.variables.some((v) => v.toLowerCase().includes(q))
  );
}
