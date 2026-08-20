import { useMemo } from "react";
import { EmptyState } from "@shared/components/empty-state/empty-state";
import { ErrorState, PageSkeleton } from "@shared/ui";
import { useOpportunities } from "@features/opportunities/hooks/use-opportunities";
import { useContacts } from "@features/contacts/hooks/use-contacts";
import { PIPELINE_STAGES, STAGE_LABELS, type Opportunity } from "@features/opportunities/types";
import { formatCLP } from "@/lib/locale-cl";
import { formatDayMonth } from "@shared/utils/format";

// One accent hue per stage so each lane dot reads distinctly. We avoid raw hex
// in className by driving the dot color through an inline CSS var reference.
const STAGE_DOT: Record<string, string> = {
  LEAD: "var(--chart-1)",
  QUALIFIED: "var(--chart-2)",
  VISIT: "var(--chart-3)",
  OFFER: "var(--success)",
  RESERVATION: "var(--warning)",
  CLOSED: "var(--chart-3)",
};

function relTime(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - Date.parse(iso);
  const day = 86_400_000;
  if (diff < day) return "hoy";
  const days = Math.floor(diff / day);
  if (days < 7) return `hace ${days}d`;
  return formatDayMonth(iso);
}

/**
 * Pipeline tab: opportunity stage lanes. Reuses `useOpportunities` (OPEN only)
 * and resolves contact names via `useContacts`, mirroring OpportunitiesPage.
 * Each lane is a labeled column with a count; cards scroll horizontally.
 */
export function CrmPipeline() {
  const { data, isLoading, error, refetch } = useOpportunities({ status: "OPEN", limit: 500 });
  const { data: contacts } = useContacts({ limit: 500 });

  const nameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of contacts ?? []) m.set(c.id, c.full_name);
    return m;
  }, [contacts]);

  const byStage = useMemo(() => {
    const m = new Map<string, Opportunity[]>();
    for (const stage of PIPELINE_STAGES) m.set(stage, []);
    for (const opp of data ?? []) {
      const lane = m.get(opp.pipeline_stage);
      if (lane) lane.push(opp);
      else m.set(opp.pipeline_stage, [opp]);
    }
    return m;
  }, [data]);

  if (isLoading) {
    return <PageSkeleton variant="list" count={5} className="pt-1" />;
  }

  if (error) {
    return <ErrorState message="No se pudo cargar el pipeline." onRetry={() => refetch()} />;
  }

  if ((data?.length ?? 0) === 0) {
    return (
      <EmptyState
        title="Sin oportunidades abiertas"
        description="Las oportunidades aparecen aquí a medida que avanzan en el pipeline."
      />
    );
  }

  return (
    <div className="pt-1">
      {PIPELINE_STAGES.map((stage) => {
        const items = byStage.get(stage) ?? [];
        return (
          <div key={stage} className="mb-2">
            <div className="flex items-center gap-2 pb-2 pt-3">
              <span
                className="size-2.5 rounded-full"
                style={{ background: STAGE_DOT[stage] ?? "var(--chart-3)" }}
              />
              <span className="text-[15px] font-bold tracking-tight text-foreground">
                {STAGE_LABELS[stage] ?? stage}
              </span>
              <span className="text-[13px] font-semibold text-faint">{items.length}</span>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {items.length === 0 && (
                <div className="py-2 text-[13px] text-faint">Sin oportunidades</div>
              )}
              {items.map((opp) => {
                const name = opp.person_id
                  ? (nameMap.get(opp.person_id) ?? "Sin contacto")
                  : "Sin contacto";
                const value =
                  opp.expected_value_cents != null
                    ? formatCLP(opp.expected_value_cents / 100)
                    : "Sin valor";
                return (
                  <div
                    key={opp.id}
                    className="w-[200px] shrink-0 rounded-xl border border-border bg-card p-3"
                  >
                    <div className="truncate text-[14.5px] font-semibold text-foreground">
                      {name}
                    </div>
                    <div className="mt-1 text-[13px] text-muted-foreground">{value}</div>
                    <div className="mt-3 border-t border-border pt-2 text-xs text-faint">
                      {relTime(opp.updated_at) || "Sin actividad"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
