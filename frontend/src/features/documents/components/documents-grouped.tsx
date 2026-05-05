import { useMemo } from "react";
import { useProperties, useContacts } from "../hooks/use-entities";
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
  const { data: properties } = useProperties(undefined, { enabled: groupBy === "property" });
  const { data: contacts } = useContacts(undefined, { enabled: groupBy === "contact" });

  const labelFor = useMemo(() => {
    const map = new Map<string, string>();
    if (groupBy === "property" && properties) {
      for (const p of properties) map.set(p.id, p.title);
    }
    if (groupBy === "contact" && contacts) {
      for (const c of contacts) map.set(c.id, c.full_name);
    }
    return map;
  }, [groupBy, properties, contacts]);

  const groups: Group[] = useMemo(() => {
    const buckets = new Map<string, DocumentItem[]>();
    const unassignedLabel = groupBy === "property" ? "Sin propiedad" : "Sin contacto";

    for (const doc of documents) {
      const ids = (doc.assignments ?? [])
        .map((a) => (groupBy === "property" ? a.property_id : a.contact_id))
        .filter((id): id is string => Boolean(id));
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
      result.push({ key, label: labelFor.get(key) ?? "(desconocido)", docs });
    }
    result.sort((a, b) => a.label.localeCompare(b.label, "es"));
    const unassigned = buckets.get(UNASSIGNED_KEY);
    if (unassigned && unassigned.length > 0) {
      result.push({ key: UNASSIGNED_KEY, label: unassignedLabel, docs: unassigned });
    }
    return result;
  }, [documents, groupBy, labelFor]);

  if (groups.length === 0) return null;

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.key}>
          <div className="mb-2 flex items-baseline gap-2">
            <h3 className="text-sm font-semibold">{group.label}</h3>
            <span className="text-xs text-muted-foreground">{group.docs.length}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {group.docs.map((doc) => (
              <DocumentCard key={`${group.key}-${doc.id}`} doc={doc} onOpen={onOpen} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
