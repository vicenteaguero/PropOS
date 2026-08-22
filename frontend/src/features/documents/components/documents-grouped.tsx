import { useMemo } from "react";
import type { DocumentItem } from "../types";
import { DocumentCard } from "./document-card";

interface Props {
  documents: DocumentItem[];
  groupBy: "property" | "contact";
  onOpen: (doc: DocumentItem) => void;
}

interface Group {
  key: string;
  label: string;
  docs: DocumentItem[];
}

const UNASSIGNED_KEY = "__unassigned__";

export function DocumentsGrouped({ documents, groupBy, onOpen }: Props) {
  // Labels ride along on each assignment now. They used to be looked up in
  // `/v1/properties` and `/v1/contacts`, which both default to 100 rows, so on
  // a tenant with 250 contacts every group past the first hundred was titled
  // "(desconocido)" — which is what made this feature look broken.
  const groups: Group[] = useMemo(() => {
    const buckets = new Map<string, DocumentItem[]>();
    const unassignedLabel = groupBy === "property" ? "Sin propiedad" : "Sin contacto";

    const labelFor = new Map<string, string>();
    for (const doc of documents) {
      const ids = (doc.assignments ?? [])
        .filter((a) => (groupBy === "property" ? a.property_id : a.contact_id))
        .map((a) => {
          const id = (groupBy === "property" ? a.property_id : a.contact_id) as string;
          if (a.label) labelFor.set(id, a.label);
          return id;
        });
      const unique = Array.from(new Set(ids));
      if (unique.length === 0) {
        const list = buckets.get(UNASSIGNED_KEY) ?? [];
        list.push(doc);
        buckets.set(UNASSIGNED_KEY, list);
      } else {
        for (const id of unique) {
          const list = buckets.get(id) ?? [];
          list.push(doc);
          buckets.set(id, list);
        }
      }
    }

    const result: Group[] = [];
    for (const [key, docs] of buckets.entries()) {
      if (key === UNASSIGNED_KEY) continue;
      result.push({ key, label: labelFor.get(key) ?? "Sin nombre", docs });
    }
    result.sort((a, b) => a.label.localeCompare(b.label, "es"));
    const unassigned = buckets.get(UNASSIGNED_KEY);
    if (unassigned && unassigned.length > 0) {
      result.push({ key: UNASSIGNED_KEY, label: unassignedLabel, docs: unassigned });
    }
    return result;
  }, [documents, groupBy]);

  if (groups.length === 0) return null;

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.key}>
          <div className="mb-3 flex items-baseline gap-2">
            <h3 className="text-base font-bold tracking-tight text-foreground">{group.label}</h3>
            <span className="text-[13px] text-muted-foreground">{group.docs.length}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
            {group.docs.map((doc) => (
              <DocumentCard key={`${group.key}-${doc.id}`} doc={doc} onOpen={onOpen} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
