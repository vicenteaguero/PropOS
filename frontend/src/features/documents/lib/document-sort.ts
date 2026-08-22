import type { DocumentItem } from "../types";

/**
 * How the documents list is ordered.
 *
 * The server returns `sort_order, created_at desc` — the order things arrived,
 * which is the one order nobody works in: the mandate you opened this morning
 * sinks under whatever was scanned since. These are the questions people
 * actually ask of a document list.
 */
export type SortMode = "recent" | "created" | "name" | "priority";

export const SORT_OPTIONS: { value: SortMode; label: string; sub: string }[] = [
  { value: "recent", label: "Usados hace poco", sub: "Último que abriste" },
  { value: "created", label: "Más nuevos", sub: "Fecha en que se agregó" },
  { value: "name", label: "Nombre", sub: "A → Z" },
  { value: "priority", label: "Prioritarios primero", sub: "Los marcados arriba" },
];

const time = (value: string | null | undefined): number => (value ? Date.parse(value) : 0);

/** Stable, non-mutating sort. Ties fall back to newest-first so it never jitters. */
export function sortDocuments(docs: DocumentItem[], mode: SortMode): DocumentItem[] {
  const byCreated = (a: DocumentItem, b: DocumentItem) => time(b.created_at) - time(a.created_at);
  const copy = [...docs];
  switch (mode) {
    case "recent":
      return copy.sort((a, b) => {
        // A document nobody has opened yet has no business outranking one that
        // was opened an hour ago, so absent stamps sort last rather than as 0.
        const diff = time(b.last_opened_at) - time(a.last_opened_at);
        return diff !== 0 ? diff : byCreated(a, b);
      });
    case "created":
      return copy.sort(byCreated);
    case "name":
      return copy.sort((a, b) => a.display_name.localeCompare(b.display_name, "es"));
    case "priority":
      return copy.sort((a, b) => {
        const diff = Number(b.is_priority ?? false) - Number(a.is_priority ?? false);
        return diff !== 0 ? diff : byCreated(a, b);
      });
    default:
      return copy;
  }
}
