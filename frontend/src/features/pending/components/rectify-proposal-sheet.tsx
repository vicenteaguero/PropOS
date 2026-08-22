import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, ResponsiveSheet, SheetActions } from "@shared/ui";
import { fieldLabel } from "../lib/field-labels";
import type { PendingProposal } from "@features/agent/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposal: PendingProposal;
  submitting: boolean;
  error?: string | null;
  /** Only the fields the reviewer actually changed. */
  onConfirm: (overrides: Record<string, unknown>) => void;
}

/** Keys that are plumbing, not content. Same rule the card's preview uses. */
function isEditable(key: string, value: unknown): boolean {
  if (key === "summary" || key === "summary_es") return false;
  if (key === "id" || key.endsWith("_id") || key.endsWith("_ids")) return false;
  return typeof value === "string" || typeof value === "number";
}

/** A long value gets a textarea; everything else gets one line. */
const isLong = (value: unknown) => typeof value === "string" && value.length > 60;

/**
 * Correct a proposal before accepting it.
 *
 * The API has taken `overrides` since day one and no screen ever sent them, so
 * a proposal that got one field wrong could only be rejected wholesale — and
 * then retyped by hand somewhere else. This is the middle button on the card,
 * and the reason it is the widest one: "almost right" is the common case.
 *
 * Only dirty fields are sent, so an untouched form behaves exactly like plain
 * Aceptar. The server whitelists whatever arrives against the intent that
 * declared it (`backend/app/features/pending/overrides.py`); a 422 lands here.
 */
export function RectifyProposalSheet({
  open,
  onOpenChange,
  proposal,
  submitting,
  error,
  onConfirm,
}: Props) {
  const source = (proposal.resolved_payload ?? proposal.payload ?? {}) as Record<string, unknown>;
  const fields = Object.entries(source).filter(([k, v]) => isEditable(k, v));
  const [draft, setDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) setDraft({});
  }, [open, proposal.id]);

  const valueOf = (key: string) => draft[key] ?? String(source[key] ?? "");

  const submit = () => {
    const overrides: Record<string, unknown> = {};
    for (const [key, original] of fields) {
      const next = draft[key];
      if (next === undefined || next === String(original ?? "")) continue;
      overrides[key] = typeof original === "number" ? Number(next) : next;
    }
    onConfirm(overrides);
  };

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Rectificar"
      desktopClassName="max-w-lg"
    >
      <div className="mt-4 space-y-3">
        {fields.length === 0 && (
          <p className="text-sm text-muted-foreground">Esta propuesta no tiene campos editables.</p>
        )}
        {fields.map(([key, original]) => (
          <Field key={key} label={fieldLabel(key)}>
            {isLong(original) ? (
              <Textarea
                rows={3}
                value={valueOf(key)}
                onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                className="resize-none rounded-xl"
              />
            ) : (
              <Input
                inputMode={typeof original === "number" ? "numeric" : undefined}
                value={valueOf(key)}
                onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
              />
            )}
          </Field>
        ))}
        {error && <p className="text-[13px] text-destructive">{error}</p>}
      </div>

      <SheetActions>
        <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
          Cancelar
        </Button>
        <Button onClick={submit} disabled={submitting} className="gap-2">
          {submitting && <Loader2 className="size-4 animate-spin" />}
          Aceptar con cambios
        </Button>
      </SheetActions>
    </ResponsiveSheet>
  );
}
