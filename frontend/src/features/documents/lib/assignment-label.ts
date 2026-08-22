import type { DocumentItem } from "../types";

/**
 * Where a document belongs, in one line.
 *
 * Property wins over contact: a mandate belongs to the flat first and to the
 * owner second, and that is the order a broker looks for it in. Labels are
 * resolved server-side (see `Assignment.label`) precisely so this never has to
 * join against a capped list.
 */
export function primaryAssignmentLabel(doc: DocumentItem): string | null {
  const assignments = doc.assignments ?? [];
  const property = assignments.find((a) => a.property_id && a.label);
  const contact = assignments.find((a) => a.contact_id && a.label);
  const area = assignments.find((a) => a.internal_area_id && a.label);
  const label = property?.label ?? contact?.label ?? area?.label ?? null;
  if (!label) return null;
  // Documents are very often named after what they hang off — "Mandato de
  // corretaje Nº 001 — Departamento 1D/1B en venta en La Reina" — and printing
  // the property again underneath it is the same sentence twice, which reads
  // as a bug rather than as context.
  return titleContains(doc.display_name, label) ? null : label;
}

/** Loose containment: punctuation and case differ between the two strings. */
function titleContains(title: string, label: string): boolean {
  const norm = (s: string) =>
    s
      .toLocaleLowerCase("es")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const t = norm(title);
  const l = norm(label);
  return l.length > 0 && t.includes(l);
}
