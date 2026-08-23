import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  ChoiceSwitch,
  FOCUS_RING,
  FilterSelect,
  ResponsiveSheet,
  SheetActions,
  categoryVars,
} from "@shared/ui";
import { cn } from "@/lib/utils";
import type { EventBehavior, EventType, EventTypeInput } from "@features/calendar/api/calendar-api";

const BEHAVIORS: { value: EventBehavior; label: string; hint: string }[] = [
  { value: "visit", label: "Visita", hint: "Dirección, propiedad y cómo llegar" },
  { value: "meeting", label: "Reunión", hint: "Lugar, personas y negocio" },
  { value: "call", label: "Llamada", hint: "Persona y negocio" },
  { value: "deadline", label: "Vencimiento", hint: "Negocio y propiedad" },
  { value: "other", label: "Otro", hint: "Solo lo básico" },
];

/** "Tasación urbana" → "TASACION_URBANA". */
function keyFrom(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32)
    .replace(/^[^A-Z]/, "T");
}

interface Props {
  open: boolean;
  type: EventType | null;
  existing: EventType[];
  onOpenChange: (open: boolean) => void;
  saving: boolean;
  onSave: (values: EventTypeInput) => void;
  onDelete?: () => void;
}

/**
 * One event type.
 *
 * The key is derived from the label and shown read-only once the type exists,
 * because `events.kind` stores the key as text with no foreign key — renaming
 * it would orphan every event already filed under it. The label is what the
 * broker edits, and the label is what they see everywhere.
 */
export function EventTypeSheet({
  open,
  type,
  existing,
  onOpenChange,
  saving,
  onSave,
  onDelete,
}: Props) {
  const [label, setLabel] = useState("");
  const [color, setColor] = useState<string>("slate");
  const [behavior, setBehavior] = useState<EventBehavior>("other");
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLabel(type?.label ?? "");
    setColor(type?.color ?? "slate");
    setBehavior(type?.behavior ?? "other");
    setActive(type?.active ?? true);
  }, [open, type]);

  const key = type?.key ?? keyFrom(label);
  const clash =
    !type && key.length > 0 && existing.some((t) => t.key === key)
      ? "Ya existe un tipo con ese nombre."
      : null;

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={type ? "Editar tipo" : "Nuevo tipo de evento"}
    >
      <div className="mt-4 space-y-3">
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Nombre del tipo…"
          aria-label="Nombre del tipo"
        />
        {clash && <p className="text-[12px] text-destructive">{clash}</p>}
        <p className="text-[12px] text-muted-foreground">
          {/* Shown, not hidden: the key is what the calendar filter and every
              already-saved event carry, so it has to be predictable. */}
          Clave: <span className="font-mono">{key || "—"}</span>
          {type && " · no se puede cambiar"}
        </p>

        <div>
          <span id="event-type-color" className="mb-1.5 block text-[13px] font-medium">
            Color
          </span>
          <div
            role="radiogroup"
            aria-labelledby="event-type-color"
            className="flex flex-wrap gap-1.5"
          >
            {CATEGORY_COLORS.map((c) => {
              const vars = categoryVars(c);
              return (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={color === c}
                  aria-label={CATEGORY_LABELS[c]}
                  onClick={() => setColor(c)}
                  className={cn(
                    "size-8 rounded-full border-2 transition",
                    FOCUS_RING,
                    color === c ? "scale-110" : "border-transparent",
                  )}
                  style={{
                    background: vars.wash,
                    borderColor: color === c ? vars.ink : undefined,
                  }}
                >
                  <span
                    aria-hidden
                    className="mx-auto block size-3 rounded-full"
                    style={{ background: vars.ink }}
                  />
                </button>
              );
            })}
          </div>
        </div>

        <FilterSelect
          label="Se comporta como"
          value={behavior}
          options={BEHAVIORS.map((b) => ({ value: b.value, label: b.label, sub: b.hint }))}
          onChange={(v) => setBehavior((v ?? "other") as EventBehavior)}
        />

        <ChoiceSwitch
          label="Disponible"
          value={active ? "yes" : "no"}
          options={[
            { value: "yes", label: "Activo" },
            { value: "no", label: "Oculto" },
          ]}
          onChange={(v) => setActive(v === "yes")}
        />
      </div>

      <SheetActions>
        {onDelete && !type?.is_system && (
          <Button variant="ghost" className="text-destructive sm:mr-auto" onClick={onDelete}>
            Eliminar
          </Button>
        )}
        <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
          Cancelar
        </Button>
        <Button
          variant="ink"
          disabled={saving || !label.trim() || !!clash}
          onClick={() => onSave({ key, label: label.trim(), color, behavior, active })}
        >
          Guardar
        </Button>
      </SheetActions>
    </ResponsiveSheet>
  );
}
