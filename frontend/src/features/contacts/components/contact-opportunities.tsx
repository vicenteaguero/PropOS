import { useState } from "react";
import { Loader2 } from "lucide-react";
import { ErrorState, Pill, Row, SectionLabel, type PillTone } from "@shared/ui";
import { toast } from "sonner";
import {
  useCreateOpportunity,
  useOpportunities,
} from "@features/opportunities/hooks/use-opportunities";
import { OpportunityFormDialog } from "@features/opportunities/components/opportunity-form-dialog";
import { STAGE_LABELS, type OpportunityStatus } from "@features/opportunities/types";

function formatClp(cents: number | null): string {
  if (!cents) return "";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

const STATUS_TONE: Record<OpportunityStatus, PillTone> = {
  WON: "success",
  LOST: "destructive",
  OPEN: "neutral",
};

const STATUS_LABEL: Record<OpportunityStatus, string> = {
  WON: "Ganada",
  LOST: "Perdida",
  OPEN: "Abierta",
};

export function ContactOpportunities({ personId }: { personId: string }) {
  const { data, isLoading, error, refetch } = useOpportunities({ person_id: personId, limit: 100 });
  const create = useCreateOpportunity();
  const [open, setOpen] = useState(false);

  return (
    <div>
      <SectionLabel action="Nueva" onAction={() => setOpen(true)}>
        Oportunidades
      </SectionLabel>

      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {error && (
        <ErrorState message="Error al cargar." onRetry={() => refetch()} compact className="mt-3" />
      )}
      {!isLoading && !error && (data?.length ?? 0) === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">Sin oportunidades.</p>
      )}
      {!isLoading && !error && data && data.length > 0 && (
        <div className="mt-2 overflow-hidden rounded-xl bg-card">
          {data.map((o, i) => (
            <Row
              key={o.id}
              divider={i < data.length - 1}
              title={
                <span className="flex items-center gap-2">
                  <Pill tone="accent">{STAGE_LABELS[o.pipeline_stage] ?? o.pipeline_stage}</Pill>
                  <Pill tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Pill>
                </span>
              }
              sub={o.notes || undefined}
              right={
                o.expected_value_cents != null ? (
                  <span className="shrink-0 text-sm font-semibold text-foreground">
                    {formatClp(o.expected_value_cents)}
                  </span>
                ) : undefined
              }
            />
          ))}
        </div>
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
