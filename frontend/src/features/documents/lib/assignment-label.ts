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
  if (property?.label) return property.label;
  const contact = assignments.find((a) => a.contact_id && a.label);
  if (contact?.label) return contact.label;
  const area = assignments.find((a) => a.internal_area_id && a.label);
  return area?.label ?? null;
}
