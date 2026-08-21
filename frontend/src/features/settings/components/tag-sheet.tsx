import { useEffect, useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Field, FieldGroup, FOCUS_RING, ResponsiveSheet, SheetActions } from "@shared/ui";
import type { TagWrite } from "../api/catalogs-api";
import { swatchesFor, tagIssue, type Tag } from "../lib/tags";

/**
 * Create/edit one tag.
 *
 * The only thing here worth more than a text field is the delete: `taggings`
 * cascades on the tag, so removing a label used by 26 people silently takes it
 * off all 26. The count is on the screen at the moment of the decision.
 */
export function TagSheet({
  open,
  tag,
  existing,
  onOpenChange,
  onSave,
  onDelete,
  saving,
}: {
  open: boolean;
  /** null = create. */
  tag: Tag | null;
  /** Every tag, for the local name-clash check. */
  existing: Tag[];
  onOpenChange: (open: boolean) => void;
  onSave: (values: TagWrite) => void;
  onDelete?: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    setName(tag?.name ?? "");
    setColor(tag?.color ?? "");
  }, [open, tag]);

  const issue = tagIssue(name, color || null, existing, tag?.id);

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={tag ? "Editar etiqueta" : "Nueva etiqueta"}
      desktopClassName="max-w-md"
    >
      <div className="mt-2 space-y-5">
        <Field label="Nombre">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Primera vivienda"
          />
        </Field>

        <FieldGroup label="Color">
          <div className="flex flex-wrap gap-1.5">
            {swatchesFor(tag?.color ?? null).map((swatch) => (
              <button
                key={swatch}
                type="button"
                aria-label={swatch}
                aria-pressed={color.toLowerCase() === swatch}
                onClick={() => setColor(swatch)}
                style={{ backgroundColor: swatch }}
                // Selection is the ring, not a tick: a checkmark over an
                // arbitrary user-picked swatch has no token that is legible on
                // every colour, and hardcoding white fails on the pale ones.
                className={cn(
                  "size-11 rounded-full transition",
                  FOCUS_RING,
                  color.toLowerCase() === swatch
                    ? "ring-2 ring-foreground ring-offset-2 ring-offset-background"
                    : "hover:scale-105",
                )}
              />
            ))}
          </div>
          <Input
            value={color}
            onChange={(e) => setColor(e.target.value)}
            aria-label="Color en hexadecimal"
            placeholder="#3b82f6"
            className="mt-2 h-10 font-mono text-[13px]"
          />
        </FieldGroup>

        {tag && tag.usage_count > 0 && (
          <p className="flex items-start gap-2 rounded-[var(--radius)] bg-warning/12 p-3 text-[13px] leading-snug text-warning">
            <AlertTriangle className="mt-px size-4 shrink-0" strokeWidth={1.9} />
            <span>
              La usan {tag.usage_count} registros. Si la eliminas, se les quita a todos; renombrarla
              los mantiene.
            </span>
          </p>
        )}

        {issue && <p className="text-[13px] text-destructive">{issue}</p>}
      </div>

      <SheetActions>
        {tag && onDelete && (
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
        <Button
          type="button"
          onClick={() => !issue && onSave({ name: name.trim(), color: color.trim() || null })}
          disabled={!!issue || saving}
        >
          {saving ? "Guardando..." : "Guardar"}
        </Button>
      </SheetActions>
    </ResponsiveSheet>
  );
}
