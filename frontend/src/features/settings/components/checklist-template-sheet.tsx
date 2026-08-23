import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Lock, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Field,
  FieldGroup,
  FOCUS_RING,
  ResponsiveSheet,
  SectionLabel,
  SheetActions,
  TOUCH_TARGET_COARSE,
  ChoiceSwitch,
} from "@shared/ui";
import { label } from "@shared/lib/labels";
import type { ChecklistTemplateWrite } from "../api/catalogs-api";
import {
  blankItem,
  checklistIssue,
  countBlocking,
  moveItem,
  removeItem,
  type ChecklistItem,
  type ChecklistTemplate,
} from "../lib/checklist-templates";

const OPERATION_KINDS = ["venta", "arriendo"] as const;

/** Roles that already appear in the seeded lists. Free text underneath, so an
 *  unusual one can still be typed. */
const OWNER_ROLES = ["corredor", "abogado", "banco", "comprador", "vendedor", "propietario"];

function ItemCard({
  item,
  index,
  total,
  expanded,
  onToggle,
  onChange,
  onMove,
  onRemove,
}: {
  item: ChecklistItem;
  index: number;
  total: number;
  expanded: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<ChecklistItem>) => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <li
      className={cn(
        "overflow-hidden rounded-[var(--radius)] border bg-card",
        // A blocking step wears the colour of what it does. Scanning the list
        // has to answer "what stops the close" without opening anything.
        item.blocking ? "border-destructive/40 bg-destructive/[0.04]" : "border-border",
      )}
    >
      <div className="flex items-center gap-2 p-2 pl-3">
        <span
          className={cn(
            "w-5 shrink-0 font-mono text-[12px] tabular-nums",
            item.blocking ? "text-destructive" : "text-faint",
          )}
        >
          {index + 1}
        </span>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className={cn(
            "min-w-0 flex-1 rounded-[var(--radius)] py-1.5 text-left",
            TOUCH_TARGET_COARSE,
            FOCUS_RING,
          )}
        >
          <span className="block truncate text-[15px] font-medium text-foreground">
            {item.title || <span className="text-faint">Paso sin título</span>}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-muted-foreground">
            {item.blocking && (
              <span className="font-medium text-destructive">Bloquea el cierre</span>
            )}
            {item.owner_role && <span>{label("checklistOwnerRole", item.owner_role)}</span>}
            {item.due_offset_days !== null && <span>día {item.due_offset_days}</span>}
          </span>
        </button>
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            aria-label={`Subir el paso ${index + 1}`}
            className={cn(
              "flex size-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary disabled:opacity-25",
              TOUCH_TARGET_COARSE,
              FOCUS_RING,
            )}
          >
            <ChevronUp className="size-4" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            aria-label={`Bajar el paso ${index + 1}`}
            className={cn(
              "flex size-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary disabled:opacity-25",
              TOUCH_TARGET_COARSE,
              FOCUS_RING,
            )}
          >
            <ChevronDown className="size-4" strokeWidth={2} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="space-y-3.5 border-t border-border px-3 pt-3 pb-3.5">
          <Field label="Título">
            <Input
              value={item.title}
              onChange={(e) => onChange({ title: e.target.value })}
              placeholder="Estudio de títulos"
            />
          </Field>

          <FieldGroup
            label="¿Qué pasa si falta?"
            hint={
              item.blocking
                ? "El negocio no se puede cerrar hasta que este paso esté listo."
                : "Queda pendiente y a la vista, pero no impide cerrar."
            }
          >
            <ChoiceSwitch
              label="Qué pasa si falta este paso"
              value={item.blocking ? "blocking" : "informative"}
              onChange={(v) => onChange({ blocking: v === "blocking" })}
              options={[
                {
                  value: "blocking",
                  label: "Frena el cierre",
                  icon: <Lock className="size-3.5" strokeWidth={2} />,
                  activeClassName: "bg-destructive text-destructive-foreground",
                },
                { value: "informative", label: "Sólo avisa" },
              ]}
            />
          </FieldGroup>

          <Field label="Detalle" hint="Opcional. Lo que hay que hacer, en una línea.">
            <Textarea
              value={item.description ?? ""}
              onChange={(e) => onChange({ description: e.target.value || null })}
              rows={2}
              className="min-h-0"
            />
          </Field>

          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Responsable">
              <Input
                value={item.owner_role ?? ""}
                list="checklist-owner-roles"
                placeholder="corredor"
                onChange={(e) => onChange({ owner_role: e.target.value || null })}
              />
            </Field>
            <Field label="Plazo" hint="Días desde el acuerdo. Vacío = sin fecha.">
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                value={item.due_offset_days ?? ""}
                placeholder="—"
                onChange={(e) =>
                  onChange({
                    due_offset_days: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            </Field>
          </div>

          <Field label="Documento" hint="Opcional. El archivo que cierra el paso.">
            <Input
              value={item.document_kind ?? ""}
              placeholder="certificado_dominio"
              className="font-mono text-[13px]"
              onChange={(e) => onChange({ document_kind: e.target.value || null })}
            />
          </Field>

          <button
            type="button"
            onClick={onRemove}
            className={cn(
              "flex items-center gap-1.5 rounded-[var(--radius)] px-1 py-1 text-[13px] font-medium text-destructive transition hover:opacity-80",
              TOUCH_TARGET_COARSE,
              FOCUS_RING,
            )}
          >
            <Trash2 className="size-3.5" strokeWidth={1.9} />
            Quitar paso
          </button>
        </div>
      )}
    </li>
  );
}

/**
 * Create/edit one closing checklist.
 *
 * Items are an accordion rather than a grid of inputs: eleven steps with six
 * fields each is 66 controls, and on a phone that is a form nobody finishes.
 * Collapsed, a step shows the three things worth scanning — its number, its
 * title, and whether it stops the close.
 */
export function ChecklistTemplateSheet({
  open,
  template,
  onOpenChange,
  onSave,
  onDelete,
  saving,
}: {
  open: boolean;
  /** null = create. */
  template: ChecklistTemplate | null;
  onOpenChange: (open: boolean) => void;
  onSave: (values: ChecklistTemplateWrite) => void;
  onDelete?: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState("");
  const [operationKind, setOperationKind] = useState("venta");
  const [isDefault, setIsDefault] = useState(false);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(template?.name ?? "");
    setOperationKind(template?.operation_kind ?? "venta");
    setIsDefault(template?.is_default ?? false);
    setItems(template ? template.items.map((item) => ({ ...item })) : [blankItem(1)]);
    setExpanded(template ? null : 0);
  }, [open, template]);

  const issue = useMemo(() => checklistIssue(name, items), [name, items]);
  const blocking = countBlocking(items);

  const patch = (index: number, values: Partial<ChecklistItem>) =>
    setItems((list) => list.map((item, i) => (i === index ? { ...item, ...values } : item)));

  const addItem = () => {
    setItems((list) => [...list, blankItem(list.length + 1)]);
    setExpanded(items.length);
  };

  const submit = () => {
    if (issue) return;
    onSave({
      name: name.trim(),
      operation_kind: operationKind.trim(),
      is_default: isDefault,
      items: items.map((item) => ({
        title: item.title.trim(),
        description: item.description,
        blocking: item.blocking,
        owner_role: item.owner_role,
        due_offset_days: item.due_offset_days,
        document_kind: item.document_kind,
      })),
    });
  };

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={template ? "Editar lista" : "Nueva lista"}
      desktopClassName="max-w-2xl max-h-[88vh] overflow-y-auto"
    >
      <datalist id="checklist-owner-roles">
        {OWNER_ROLES.map((role) => (
          <option key={role} value={role} />
        ))}
      </datalist>

      <div className="mt-2 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Cierre de venta"
            />
          </Field>
          <FieldGroup label="Operación">
            <ChoiceSwitch
              label="Tipo de operación"
              value={operationKind}
              onChange={setOperationKind}
              options={[
                { value: OPERATION_KINDS[0], label: label("operationKind", OPERATION_KINDS[0]) },
                { value: OPERATION_KINDS[1], label: label("operationKind", OPERATION_KINDS[1]) },
              ]}
            />
          </FieldGroup>
        </div>

        <FieldGroup
          label="Al llegar al acuerdo"
          hint={
            isDefault
              ? `Cada negocio de ${label("operationKind", operationKind).toLowerCase()} que llegue al acuerdo abre esta lista.`
              : "Sólo se usa si la eliges a mano."
          }
        >
          <ChoiceSwitch
            label="Uso por defecto"
            value={isDefault ? "default" : "manual"}
            onChange={(v) => setIsDefault(v === "default")}
            options={[
              { value: "default", label: "Se abre sola" },
              { value: "manual", label: "A pedido" },
            ]}
          />
        </FieldGroup>

        <div>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <SectionLabel>
              Pasos
              <span className="ml-2 text-[12px] font-normal text-muted-foreground">
                {items.length} en total
                {blocking > 0 && (
                  <>
                    {" · "}
                    <span className="text-destructive">{blocking} frenan el cierre</span>
                  </>
                )}
              </span>
            </SectionLabel>
            <Button type="button" size="sm" variant="outline" onClick={addItem}>
              <Plus className="size-3.5" strokeWidth={2} />
              Paso
            </Button>
          </div>

          <ul className="space-y-1.5">
            {items.map((item, index) => (
              <ItemCard
                key={item.id ?? `new-${index}`}
                item={item}
                index={index}
                total={items.length}
                expanded={expanded === index}
                onToggle={() => setExpanded((current) => (current === index ? null : index))}
                onChange={(values) => patch(index, values)}
                onMove={(delta) => {
                  setItems((list) => moveItem(list, index, delta));
                  setExpanded(null);
                }}
                onRemove={() => {
                  setItems((list) => removeItem(list, index));
                  setExpanded(null);
                }}
              />
            ))}
          </ul>
        </div>

        {issue && <p className="text-[13px] text-destructive">{issue}</p>}
      </div>

      <SheetActions>
        {template && onDelete && (
          <Button
            type="button"
            variant="ghost"
            onClick={onDelete}
            className="text-destructive hover:text-destructive sm:mr-auto"
          >
            <Trash2 className="size-4" strokeWidth={1.8} />
            Eliminar
          </Button>
        )}
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button type="button" onClick={submit} disabled={!!issue || saving}>
          {saving ? "Guardando..." : "Guardar"}
        </Button>
      </SheetActions>
    </ResponsiveSheet>
  );
}
