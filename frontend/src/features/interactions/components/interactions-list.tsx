import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "sonner";
import {
  useCreateInteraction,
  useDeleteInteraction,
  useInteractions,
} from "../hooks/use-interactions";
import { INTERACTION_KINDS, INTERACTION_KIND_LABELS, type InteractionKind } from "../types";

interface Props {
  /** Filter + prefill participant by contact. */
  personId?: string;
  /** Filter + prefill target by property. */
  propertyId?: string;
}

function fmt(ts: string | null): string {
  if (!ts) return "";
  return new Date(ts).toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" });
}

export function InteractionsList({ personId, propertyId }: Props) {
  const { data, isLoading, error, refetch } = useInteractions({
    person_id: personId,
    property_id: propertyId,
    limit: 200,
  });
  const create = useCreateInteraction();
  const del = useDeleteInteraction();

  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<InteractionKind>("CALL");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");

  const submit = async () => {
    if (!summary.trim()) {
      toast.error("Agregá un resumen");
      return;
    }
    await create.mutateAsync({
      kind,
      summary: summary.trim(),
      body: body.trim() || null,
      participants: personId ? [{ person_id: personId }] : [],
      targets: propertyId ? [{ target_kind: "PROPERTY", property_id: propertyId }] : [],
    });
    toast.success("Interacción registrada");
    setSummary("");
    setBody("");
    setOpen(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="gap-2">
          <Plus className="size-4" />
          Registrar
        </Button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Error al cargar.
          <Button variant="ghost" size="sm" className="ml-2" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      )}
      {!isLoading && !error && (data?.length ?? 0) === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Sin interacciones registradas.
        </p>
      )}
      {!isLoading && !error && data && data.length > 0 && (
        <ul className="space-y-2">
          {data.map((it) => (
            <li key={it.id} className="rounded-md border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {INTERACTION_KIND_LABELS[it.kind] ?? it.kind}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {fmt(it.occurred_at ?? it.created_at)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm">{it.summary}</p>
                  {it.body && <p className="mt-0.5 text-xs text-muted-foreground">{it.body}</p>}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 text-muted-foreground"
                  onClick={() => del.mutate(it.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar interacción</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="i-kind">Tipo</Label>
              <select
                id="i-kind"
                value={kind}
                onChange={(e) => setKind(e.target.value as InteractionKind)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {INTERACTION_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {INTERACTION_KIND_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="i-summary">Resumen</Label>
              <Input id="i-summary" value={summary} onChange={(e) => setSummary(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="i-body">Detalle (opcional)</Label>
              <Textarea
                id="i-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={create.isPending}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={create.isPending} className="gap-2">
              {create.isPending && <Loader2 className="size-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
