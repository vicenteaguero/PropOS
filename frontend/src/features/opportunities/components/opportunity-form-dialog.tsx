import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useContacts } from "@features/contacts/hooks/use-contacts";
import { PIPELINE_STAGES, STAGE_LABELS, type Opportunity, type OpportunityInput } from "../types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunity?: Opportunity;
  /** Lock the contact (e.g. when created from a contact detail page). */
  lockedPersonId?: string;
  onSubmit: (input: OpportunityInput) => Promise<unknown>;
  pending: boolean;
}

export function OpportunityFormDialog({
  open,
  onOpenChange,
  opportunity,
  lockedPersonId,
  onSubmit,
  pending,
}: Props) {
  const [personId, setPersonId] = useState<string>("");
  const [stage, setStage] = useState<string>("LEAD");
  const [value, setValue] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [search, setSearch] = useState("");

  const { data: contacts } = useContacts({ q: search || undefined, limit: 50 });

  useEffect(() => {
    if (open) {
      setPersonId(lockedPersonId ?? opportunity?.person_id ?? "");
      setStage(opportunity?.pipeline_stage ?? "LEAD");
      setValue(
        opportunity?.expected_value_cents
          ? String(Math.round(opportunity.expected_value_cents / 100))
          : "",
      );
      setNotes(opportunity?.notes ?? "");
      setSearch("");
    }
  }, [open, opportunity, lockedPersonId]);

  const submit = async () => {
    await onSubmit({
      person_id: personId || null,
      pipeline_stage: stage,
      expected_value_cents: value ? Math.round(Number(value) * 100) : null,
      notes: notes.trim() || null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{opportunity ? "Editar oportunidad" : "Nueva oportunidad"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {!lockedPersonId && (
            <div className="space-y-1.5">
              <Label>Contacto</Label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar contacto"
              />
              <select
                value={personId}
                onChange={(e) => setPersonId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Sin contacto</option>
                {(contacts ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="o-stage">Etapa</Label>
            <select
              id="o-stage"
              value={stage}
              onChange={(e) => setStage(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {PIPELINE_STAGES.map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="o-value">Valor esperado (CLP)</Label>
            <Input
              id="o-value"
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="o-notes">Notas</Label>
            <Textarea
              id="o-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pending} className="gap-2">
            {pending && <Loader2 className="size-4 animate-spin" />}
            {opportunity ? "Guardar" : "Crear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
