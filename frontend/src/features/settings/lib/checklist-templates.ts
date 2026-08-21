/**
 * Closing checklists, client side.
 *
 * A template is an ordered list, and `blocking` is the only field that changes
 * what the list DOES: a blocking step stops the close, everything else is a
 * reminder. Order and that flag are therefore the two things the editor has to
 * make hard to get wrong.
 */

export interface ChecklistItem {
  id?: string | null;
  position: number;
  title: string;
  description: string | null;
  blocking: boolean;
  owner_role: string | null;
  due_offset_days: number | null;
  document_kind: string | null;
}

export interface ChecklistTemplate {
  id: string;
  name: string;
  operation_kind: string;
  is_default: boolean;
  items: ChecklistItem[];
  updated_at: string | null;
}

/** A blank step, positioned at the end of the list it is joining. */
export function blankItem(position: number): ChecklistItem {
  return {
    position,
    title: "",
    description: null,
    blocking: false,
    owner_role: null,
    due_offset_days: null,
    document_kind: null,
  };
}

/** Renumber after a move or a delete. The server does this too; doing it here
 *  keeps the visible numbers honest before the save. */
export function renumber(items: ChecklistItem[]): ChecklistItem[] {
  return items.map((item, i) => ({ ...item, position: i + 1 }));
}

/** Moves one step up or down, or returns the list untouched at the ends. */
export function moveItem(items: ChecklistItem[], index: number, delta: -1 | 1): ChecklistItem[] {
  const target = index + delta;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  const held = next[index]!;
  next[index] = next[target]!;
  next[target] = held;
  return renumber(next);
}

export function removeItem(items: ChecklistItem[], index: number): ChecklistItem[] {
  return renumber(items.filter((_, i) => i !== index));
}

export function countBlocking(items: ChecklistItem[]): number {
  return items.filter((item) => item.blocking).length;
}

/** The last blocking step is the one that actually gates the close; the days
 *  give the list a horizon the deal page can be read against. */
export function horizonDays(items: ChecklistItem[]): number | null {
  const offsets = items
    .map((item) => item.due_offset_days)
    .filter((days): days is number => typeof days === "number");
  return offsets.length > 0 ? Math.max(...offsets) : null;
}

export function checklistIssue(name: string, items: ChecklistItem[]): string | null {
  if (!name.trim()) return "Ponle un nombre a la lista.";
  if (items.length === 0) return "Agrega al menos un paso.";
  const blank = items.findIndex((item) => !item.title.trim());
  if (blank >= 0) return `El paso ${blank + 1} no tiene título.`;
  return null;
}
