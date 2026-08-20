import { useState } from "react";
import {
  TaskEntityPicker,
  type TaskLink,
  type TaskLinkKind,
} from "@features/tasks/components/task-entity-picker";
import type { NoteTarget, NoteTargetKind } from "../api/notes-api";
import { NoteTargetChips } from "./note-target-chips";

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
 * Picks the records a note is about — many of them, unlike a task.
 *
 * Wraps `TaskEntityPicker` instead of shipping a second search UI: it already
 * solves entity search, scope gating and the type/label tabs. Each pick is
 * appended to the list and the picker is remounted (via `key`) so its internal
 * query state resets for the next one; the synthetic `value` carries only the
 * kind forward, keeping the tab the broker was already on.
 *
 * LIMIT: a note's model holds six target kinds, but this picker offers only
 * PROPERTY and CONTACT, because those are the only two the entity search API
 * exposes (`documents/api/entities-api.ts` → listProperties / listContacts).
 * Targets of the other kinds render and can be removed — the seed creates
 * opportunity and event targets — they just cannot be ADDED here until the
 * backend grows the corresponding search endpoints.
 */
export function NoteTargetPicker({ value, onChange, disabled }: Props) {
  const [round, setRound] = useState(0);
  const [kind, setKind] = useState<TaskLinkKind | null>(null);

  const add = (link: TaskLink | null) => {
    if (!link) return;
    const next: DraftTarget = { kind: link.kind, row_id: link.id, label: link.label };
    setKind(link.kind);
    setRound((r) => r + 1);
    if (value.some((t) => t.kind === next.kind && t.row_id === next.row_id)) return;
    onChange([...value, next]);
  };

  const remove = (target: NoteTarget) =>
    onChange(value.filter((t) => !(t.kind === target.kind && t.row_id === target.row_id)));

  return (
    <div className="space-y-2">
      <NoteTargetChips targets={value.map(draftToTarget)} onRemove={remove} />
      <TaskEntityPicker
        key={round}
        value={kind ? { kind, id: "", label: "" } : null}
        onChange={add}
        disabled={disabled}
      />
    </div>
  );
}
