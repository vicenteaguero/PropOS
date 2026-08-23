import type { Note } from "../api/notes-api";

/**
 * The palette a note can be painted with.
 *
 * Stored by name rather than as a colour so the same note reads correctly in
 * both themes: each entry carries a light tint and a dark one, and a hex in the
 * database would have been right in exactly one of them.
 */
export const NOTE_COLORS = [
  {
    id: "amber",
    label: "Ámbar",
    light: "rgba(250, 204, 21, 0.14)",
    dark: "rgba(250, 204, 21, 0.10)",
  },
  {
    id: "blue",
    label: "Azul",
    light: "rgba(96, 165, 250, 0.14)",
    dark: "rgba(96, 165, 250, 0.10)",
  },
  {
    id: "green",
    label: "Verde",
    light: "rgba(52, 211, 153, 0.14)",
    dark: "rgba(52, 211, 153, 0.10)",
  },
  {
    id: "pink",
    label: "Rosa",
    light: "rgba(244, 114, 182, 0.14)",
    dark: "rgba(244, 114, 182, 0.10)",
  },
  {
    id: "violet",
    label: "Violeta",
    light: "rgba(167, 139, 250, 0.14)",
    dark: "rgba(167, 139, 250, 0.10)",
  },
] as const;

export type NoteColorId = (typeof NOTE_COLORS)[number]["id"];

/** Stable per note: same id, same colour, whatever the list order is. */
function fallbackColor(id: string): (typeof NOTE_COLORS)[number] {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return NOTE_COLORS[hash % NOTE_COLORS.length]!;
}

/**
 * Background for a note card.
 *
 * The tint used to be `LIGHT_TINTS[index % 5]` — chosen from the note's
 * position in the list — so sorting or filtering repainted every card and the
 * colour meant nothing. Now it is whatever the note was given, and failing
 * that, a stable function of its id.
 */
export function noteBackground(note: Note, theme: "light" | "dark"): string | undefined {
  const chosen = NOTE_COLORS.find((c) => c.id === note.color) ?? fallbackColor(note.id);
  return theme === "light" ? chosen.light : chosen.dark;
}

export function notePriorityBucket(value: number | null | undefined): 0 | 1 | 2 {
  if (!value || value <= 0) return 0;
  return value === 1 ? 1 : 2;
}

/** First URL in the body, so the card can show a domain instead of raw text. */
export function firstLink(body: string): string | null {
  const match = body.match(/https?:\/\/[^\s]+/i);
  return match ? match[0] : null;
}

export function linkDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export type NoteSort = "recent" | "updated" | "priority";

export const NOTE_SORTS: { value: NoteSort; label: string; sub: string }[] = [
  { value: "recent", label: "Más nuevas", sub: "Fecha en que se escribió" },
  { value: "updated", label: "Editadas hace poco", sub: "Última modificación" },
  { value: "priority", label: "Prioridad", sub: "Las importantes arriba" },
];

export type NoteFilter = "all" | "pinned" | "photo" | "linked";

export const NOTE_FILTERS: { value: NoteFilter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "pinned", label: "Fijadas" },
  { value: "photo", label: "Con foto" },
  { value: "linked", label: "Vinculadas" },
];

export function matchesNoteFilter(note: Note, filter: NoteFilter): boolean {
  if (filter === "pinned") return !!note.pinned;
  if (filter === "photo") return note.attachments.some((a) => a.role === "PHOTO");
  if (filter === "linked") return note.targets.length > 0;
  return true;
}

/** Pinned always first — that is what pinning is — then the chosen order. */
export function sortNotes(notes: Note[], sort: NoteSort): Note[] {
  const time = (v: string | null | undefined) => (v ? Date.parse(v) : 0);
  return [...notes].sort((a, b) => {
    const pin = Number(!!b.pinned) - Number(!!a.pinned);
    if (pin !== 0) return pin;
    if (sort === "priority") {
      const p = notePriorityBucket(b.priority) - notePriorityBucket(a.priority);
      if (p !== 0) return p;
    }
    if (sort === "updated") return time(b.updated_at) - time(a.updated_at);
    return time(b.created_at) - time(a.created_at);
  });
}
