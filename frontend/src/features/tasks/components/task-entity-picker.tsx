import { useRef, useState } from "react";
import { Chip, Chips } from "@shared/ui";
import { useAuth } from "@shared/hooks/use-auth";
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

/**
 * Mirrors `require_scope` on the backend — an empty admin scope means full
 * access. `/v1/contacts` sits behind the "crm" scope while `/v1/tasks` needs
 * "productividad", so a narrowly scoped admin can reach this form but not the
 * contact search; hiding the chip beats offering a control that 403s.
 */
function hasScope(scope: string[] | undefined, needed: string): boolean {
  const current = scope ?? [];
  return current.length === 0 || current.includes(needed);
}

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
  const { user } = useAuth();
  const canSearchContacts = hasScope(user?.adminScope, "crm");
  const modes = canSearchContacts ? MODES : MODES.filter((m) => m.id !== "CONTACT");

  const [mode, setMode] = useState<Mode>(value?.kind ?? "NONE");
  const [query, setQuery] = useState(value?.label ?? "");
  // What the last pick resolved to. The combobox fires onSelect and then the
  // text change in the same tick, so comparing against the `value` prop would
  // still see the previous link and wipe the pick that just happened.
  const pickedLabel = useRef<string | null>(value?.label ?? null);

  // Only the active tab queries; the other stays idle instead of prefetching.
  const properties = useProperties(query, { enabled: mode === "PROPERTY" });
  const contacts = useContacts(query, { enabled: mode === "CONTACT" });

  const pick = (link: TaskLink | null) => {
    pickedLabel.current = link?.label ?? null;
    onChange(link);
  };

  const pickMode = (next: Mode) => {
    setMode(next);
    setQuery("");
    pick(null);
  };

  // Typing after a pick invalidates it — the link must match what is shown.
  const handleQuery = (text: string) => {
    setQuery(text);
    if (pickedLabel.current && text.trim() !== pickedLabel.current.trim()) pick(null);
  };

  return (
    <div className="space-y-2">
      <Chips className="pb-0">
        {modes.map((m) => (
          <Chip key={m.id} active={mode === m.id} onClick={() => pickMode(m.id)}>
            {m.label}
          </Chip>
        ))}
      </Chips>

      {mode === "PROPERTY" && (
        <EntityCombobox<PropertyLite>
          value={query}
          onChange={handleQuery}
          onSelect={(p) => pick(p ? { kind: "PROPERTY", id: p.id, label: p.title } : null)}
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

      {mode === "CONTACT" && canSearchContacts && (
        <EntityCombobox<ContactLite>
          value={query}
          onChange={handleQuery}
          onSelect={(c) => pick(c ? { kind: "CONTACT", id: c.id, label: c.full_name } : null)}
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
