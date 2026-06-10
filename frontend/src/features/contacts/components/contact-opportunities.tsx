import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  useCreateOpportunity,
  useOpportunities,
} from "@features/opportunities/hooks/use-opportunities";
import { OpportunityFormDialog } from "@features/opportunities/components/opportunity-form-dialog";
import { STAGE_LABELS } from "@features/opportunities/types";

function formatClp(cents: number | null): string {
  if (!cents) return "";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function ContactOpportunities({ personId }: { personId: string }) {
  const { data, isLoading, error, refetch } = useOpportunities({ person_id: personId, limit: 100 });
  const create = useCreateOpportunity();
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="gap-2">
          <Plus className="size-4" />
          Nueva
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
        <p className="py-6 text-center text-sm text-muted-foreground">Sin oportunidades.</p>
      )}
      {!isLoading && !error && data && data.length > 0 && (
        <ul className="space-y-2">
          {data.map((o) => (
            <li
              key={o.id}
              className="flex items-center justify-between rounded-md border p-3 text-sm"
            >
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">
                  {STAGE_LABELS[o.pipeline_stage] ?? o.pipeline_stage}
                </Badge>
                <Badge
                  variant="outline"
                  className={
                    o.status === "WON"
                      ? "bg-emerald-500/15 text-emerald-500"
                      : o.status === "LOST"
                        ? "bg-destructive/15 text-destructive"
                        : ""
                  }
                >
                  {o.status === "WON" ? "Ganada" : o.status === "LOST" ? "Perdida" : "Abierta"}
                </Badge>
                {o.notes && <span className="text-muted-foreground">{o.notes}</span>}
              </div>
              {o.expected_value_cents != null && (
                <span className="text-muted-foreground">{formatClp(o.expected_value_cents)}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <OpportunityFormDialog
        open={open}
        onOpenChange={setOpen}
        lockedPersonId={personId}
        pending={create.isPending}
        onSubmit={async (input) => {
          await create.mutateAsync(input);
          toast.success("Oportunidad creada");
        }}
      />
    </div>
  );
}
