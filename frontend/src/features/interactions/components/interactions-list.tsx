import { useMemo, useState } from "react";
import {
  CalendarClock,
  DoorOpen,
  Loader2,
  Mail,
  MessageCircle,
  MessageSquare,
  Phone,
  Plus,
  StickyNote,
  Trash2,
  Users,
  type LucideIcon,
} from "lucide-react";
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
import { Chip, Chips, RoundButton, Row } from "@shared/ui";
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

const KIND_ICON: Record<InteractionKind, LucideIcon> = {
  VISIT: DoorOpen,
  CALL: Phone,
  EMAIL: Mail,
  WHATSAPP_LOG: MessageCircle,
  NOTE: StickyNote,
  MEETING: Users,
  SHOWING: DoorOpen,
  OTHER: MessageSquare,
};

function fmt(ts: string | null): string {
  if (!ts) return "";
  return new Date(ts).toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" });
}

function KindIcon({ kind }: { kind: InteractionKind }) {
  const Icon = KIND_ICON[kind] ?? CalendarClock;
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground">
      <Icon className="size-[18px]" strokeWidth={1.8} />
    </span>
  );
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
  const [filter, setFilter] = useState<InteractionKind | "ALL">("ALL");

  const filtered = useMemo(() => {
    if (!data) return [];
    return filter === "ALL" ? data : data.filter((it) => it.kind === filter);
  }, [data, filter]);

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
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Chips className="-mx-1 px-1">
          <Chip active={filter === "ALL"} onClick={() => setFilter("ALL")}>
            Todas
          </Chip>
          {INTERACTION_KINDS.map((k) => (
            <Chip key={k} active={filter === k} onClick={() => setFilter(k)}>
              {INTERACTION_KIND_LABELS[k]}
            </Chip>
          ))}
        </Chips>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="shrink-0 gap-2">
          <Plus className="size-4" strokeWidth={1.8} />
          Registrar
        </Button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {error && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Error al cargar.
          <Button variant="ghost" size="sm" className="ml-2" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      )}
      {!isLoading && !error && filtered.length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Sin interacciones registradas.
        </p>
      )}
      {!isLoading && !error && filtered.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {filtered.map((it, i) => (
            <Row
              key={it.id}
              divider={i < filtered.length - 1}
              left={<KindIcon kind={it.kind} />}
              title={it.summary ?? INTERACTION_KIND_LABELS[it.kind] ?? it.kind}
              sub={
                <>
                  <span className="block">{fmt(it.occurred_at ?? it.created_at)}</span>
                  {it.body && (
                    <span className="mt-0.5 line-clamp-2 block whitespace-normal text-[13px] text-muted-foreground">
                      {it.body}
                    </span>
                  )}
                </>
              }
              right={
                <RoundButton
                  tone="ghost"
                  size={32}
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => del.mutate(it.id)}
                  aria-label="Eliminar interacción"
                >
                  <Trash2 className="size-3.5" strokeWidth={1.8} />
                </RoundButton>
              }
            />
          ))}
        </div>
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
