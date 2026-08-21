import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Field, FieldGroup, ResponsiveSheet, SheetActions, TOUCH_TARGET_ROW } from "@shared/ui";
import { label } from "@shared/lib/labels";
import type { ProposalRejectReason } from "@features/agent/types";
import type { RejectBody } from "../api/pending-api";

/** Ordered by how often a reviewer reaches for it, `otro` last by definition. */
const REASONS: ProposalRejectReason[] = [
  "dato_incorrecto",
  "entidad_equivocada",
  "no_corresponde",
  "duplicado",
  "otro",
];

/** One line per motive, so the five are told apart without guessing. */
const REASON_HINT: Record<ProposalRejectReason, string> = {
  dato_incorrecto: "La acción es la correcta, pero un dato está mal.",
  entidad_equivocada: "Apunta a otra persona, propiedad u oportunidad.",
  no_corresponde: "Nadie pidió esto; no hay que registrarlo.",
  duplicado: "Ya está registrado en el sistema.",
  otro: "Ninguna de las anteriores.",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What is being rejected, echoed in the sheet so the choice has context. */
  summary: string;
  submitting?: boolean;
  onConfirm: (body: RejectBody) => void;
}

/**
 * Asks WHY before it lets a proposal be thrown away.
 *
 * Rejecting used to be a single tap that wrote nothing anywhere: the row went
 * to `rejected` and every trace of what was wrong with it died with the click.
 * That is the one moment a human is telling us, for free, where the assistant
 * is failing — so the taxonomy is required and the free text is not.
 */
export function RejectProposalSheet({
  open,
  onOpenChange,
  summary,
  submitting = false,
  onConfirm,
}: Props) {
  const [reason, setReason] = useState<ProposalRejectReason | null>(null);
  const [note, setNote] = useState("");

  // A sheet reopened on a different proposal must not arrive pre-filled with
  // the previous one's answer, which is one tap away from being submitted.
  useEffect(() => {
    if (open) {
      setReason(null);
      setNote("");
    }
  }, [open]);

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Rechazar propuesta"
      description={summary}
    >
      <div className="mt-4 space-y-5">
        <FieldGroup label="Motivo">
          <div className="overflow-hidden rounded-[var(--radius)] border border-border">
            {REASONS.map((r, i) => {
              const active = r === reason;
              return (
                <button
                  key={r}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setReason(r)}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2.5 text-left transition",
                    TOUCH_TARGET_ROW,
                    i > 0 && "border-t border-border",
                    active ? "bg-secondary" : "hover:bg-secondary/50",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold leading-tight text-foreground">
                      {label("rejectReason", r)}
                    </span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">
                      {REASON_HINT[r]}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full transition",
                      active ? "bg-foreground" : "border border-line-strong",
                    )}
                  >
                    {active && <Check className="size-3 text-background" strokeWidth={3} />}
                  </span>
                </button>
              );
            })}
          </div>
        </FieldGroup>

        <Field label="Detalle (opcional)">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Qué habría que corregir."
          />
        </Field>
      </div>

      <SheetActions>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
          Cancelar
        </Button>
        <Button
          variant="destructive"
          disabled={!reason || submitting}
          onClick={() =>
            reason &&
            onConfirm({ review_reason: reason, reason: note.trim() ? note.trim() : undefined })
          }
        >
          {submitting && <Loader2 className="size-4 animate-spin" strokeWidth={1.8} />}
          Rechazar
        </Button>
      </SheetActions>
    </ResponsiveSheet>
  );
}
