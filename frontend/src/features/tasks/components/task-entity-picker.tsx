import { useState } from "react";
import { Chip, Chips } from "@shared/ui";
import { EntityCombobox } from "@features/documents/components/entity-combobox";
import { useContacts, useProperties } from "@features/documents/hooks/use-entities";
import type { ContactLite, PropertyLite } from "@features/documents/types";
import type { TaskRelated } from "../api/tasks-api";

export type TaskLinkKind = "PROPERTY" | "CONTACT";

/** A task's single entity link, resolved to an id plus its display label. */
export interface TaskLink {
  kind: TaskLinkKind;
  id: string;
  label: string;
}

type Mode = TaskLinkKind | "NONE";

const MODES: { id: Mode; label: string }[] = [
  { id: "NONE", label: "Sin vincular" },
  { id: "PROPERTY", label: "Propiedad" },
  { id: "CONTACT", label: "Contacto" },
];

/** Maps the picked link onto the `tasks.related` JSONB shape the backend stores. */
export function linkToRelated(link: TaskLink | null): TaskRelated | undefined {
  if (!link) return undefined;
  return link.kind === "PROPERTY" ? { properties: [link.id] } : { people: [link.id] };
}

interface Props {
  value: TaskLink | null;
  onChange: (link: TaskLink | null) => void;
  disabled?: boolean;
}

/**
 * Links a task to one property or one contact. The chips pick the entity type
 * and the combobox resolves the row; the result lands in `tasks.related` so the
 * task shows up in that property's / contact's context instead of floating free.
 */
export function TaskEntityPicker({ value, onChange, disabled }: Props) {
  const [mode, setMode] = useState<Mode>(value?.kind ?? "NONE");
  const [query, setQuery] = useState(value?.label ?? "");

  // Only the active tab queries; the other stays idle instead of prefetching.
  const properties = useProperties(query, { enabled: mode === "PROPERTY" });
  const contacts = useContacts(query, { enabled: mode === "CONTACT" });

  const pickMode = (next: Mode) => {
    setMode(next);
    setQuery("");
    onChange(null);
  };

  // Typing after a pick invalidates it — the link must match what is shown.
  const handleQuery = (text: string) => {
    setQuery(text);
    if (value && text.trim() !== value.label.trim()) onChange(null);
  };

  return (
    <div className="space-y-2">
      <Chips className="pb-0">
        {MODES.map((m) => (
          <Chip key={m.id} active={mode === m.id} onClick={() => pickMode(m.id)}>
            {m.label}
          </Chip>
        ))}
      </Chips>

      {mode === "PROPERTY" && (
        <EntityCombobox<PropertyLite>
          value={query}
          onChange={handleQuery}
          onSelect={(p) => onChange(p ? { kind: "PROPERTY", id: p.id, label: p.title } : null)}
          items={properties.data ?? []}
          getLabel={(p) => p.title}
          getKey={(p) => p.id}
          loading={properties.isLoading}
          placeholder="Buscar propiedad"
          emptyText="Sin propiedades"
          disabled={disabled}
          ariaLabel="Vincular propiedad"
        />
      )}

      {mode === "CONTACT" && (
        <EntityCombobox<ContactLite>
          value={query}
          onChange={handleQuery}
          onSelect={(c) => onChange(c ? { kind: "CONTACT", id: c.id, label: c.full_name } : null)}
          items={contacts.data ?? []}
          getLabel={(c) => c.full_name}
          getKey={(c) => c.id}
          loading={contacts.isLoading}
          placeholder="Buscar contacto"
          emptyText="Sin contactos"
          disabled={disabled}
          ariaLabel="Vincular contacto"
        />
      )}
    </div>
  );
}
