import { useState } from "react";
import { Search } from "lucide-react";
import { useEntitySearch, type EntityKind } from "@shared/api/entity-search";
import { SearchInput } from "@shared/components/search-input/search-input";
import { Chip, Chips } from "@shared/ui";
import type { NoteTarget, NoteTargetKind } from "../api/notes-api";
import { KIND_LABEL, NoteTargetChips } from "./note-target-chips";

/** A link chosen in the composer, before the note exists to attach it to. */
export interface DraftTarget {
  kind: NoteTargetKind;
  row_id: string;
  label: string;
}

const TABLE_BY_KIND: Record<NoteTargetKind, string> = {
  PROPERTY: "properties",
  CONTACT: "contacts",
  OPPORTUNITY: "opportunities",
  EVENT: "events",
  PROJECT: "projects",
  PLACE: "places",
};

const KINDS: NoteTargetKind[] = ["CONTACT", "PROPERTY", "OPPORTUNITY", "EVENT", "PROJECT", "PLACE"];

/** Draft → the shape `NoteTargetChips` renders, so one chip style covers both. */
export function draftToTarget(draft: DraftTarget): NoteTarget {
  return {
    id: `draft:${draft.kind}:${draft.row_id}`,
    kind: draft.kind,
    row_id: draft.row_id,
    target_table: TABLE_BY_KIND[draft.kind],
    label: draft.label,
    resolved: true,
  };
}

interface Props {
  value: DraftTarget[];
  onChange: (next: DraftTarget[]) => void;
  disabled?: boolean;
}

/**
 * Picks the records a note is about — many of them, and of any kind.
 *
 * Backed by `/v1/search/entities`, which is the reason this is not the task
 * picker: that one reaches the per-feature list endpoints, and only properties
 * and contacts ever accepted a text filter, so four of a note's six kinds were
 * simply unreachable. Opportunities in particular cannot be searched that way at
 * all — the table has no title, its label is derived from the person and the
 * property it joins.
 */
export function NoteTargetPicker({ value, onChange, disabled }: Props) {
  const [kind, setKind] = useState<NoteTargetKind>("CONTACT");
  const [q, setQ] = useState("");
  const results = useEntitySearch(kind as EntityKind, q, !disabled);

  const add = (hit: { id: string; label: string }) => {
    if (value.some((t) => t.kind === kind && t.row_id === hit.id)) return;
    onChange([...value, { kind, row_id: hit.id, label: hit.label }]);
    setQ("");
  };

  const remove = (target: NoteTarget) =>
    onChange(value.filter((t) => !(t.kind === target.kind && t.row_id === target.row_id)));

  const hits = results.data ?? [];

  return (
    <div className="space-y-2">
      <NoteTargetChips targets={value.map(draftToTarget)} onRemove={remove} />

      <Chips>
        {KINDS.map((k) => (
          <Chip key={k} active={k === kind} onClick={() => setKind(k)}>
            {KIND_LABEL[k]}
          </Chip>
        ))}
      </Chips>

      <SearchInput
        value={q}
        onChange={setQ}
        ariaLabel={`Buscar ${KIND_LABEL[kind].toLowerCase()}`}
        placeholder={`Buscar ${KIND_LABEL[kind].toLowerCase()}…`}
        debounceMs={200}
      />

      {/* Bounded so the picker never pushes the composer's actions off screen;
          typing one more letter is faster than scrolling a long menu. */}
      <div className="max-h-48 overflow-y-auto rounded-lg border border-border">
        {results.isPending ? (
          <p className="px-3 py-2 text-[13px] text-muted-foreground">Buscando…</p>
        ) : results.isError ? (
          <p className="px-3 py-2 text-[13px] text-destructive">No se pudo buscar.</p>
        ) : hits.length === 0 ? (
          <p className="flex items-center gap-2 px-3 py-2 text-[13px] text-muted-foreground">
            <Search className="size-3.5" />
            Sin resultados
          </p>
        ) : (
          hits.map((hit, i) => (
            <button
              key={hit.id}
              type="button"
              disabled={disabled}
              onClick={() => add(hit)}
              className={`flex min-h-11 w-full flex-col items-start px-3 py-2 text-left transition active:bg-secondary ${
                i > 0 ? "border-t border-border" : ""
              }`}
            >
              <span className="w-full truncate text-[14px] font-medium text-foreground">
                {hit.label}
              </span>
              {hit.sub && (
                <span className="w-full truncate text-[12px] text-muted-foreground">{hit.sub}</span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
