import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AgentInlineProposalCard } from "@features/agent/components/agent-inline-proposal-card";
import { PageLayout } from "@shared/components/page-layout";
import { PageHeader } from "@shared/components/page-header";
import { EmptyState } from "@shared/components/empty-state/empty-state";
import { Segmented, type SegmentedItem } from "@shared/ui";
import { usePendingProposals } from "../hooks/use-pending";
import { useAgentName } from "@core/branding/agent-branding";

const TABS: SegmentedItem[] = [
  { id: "pending", label: "Pendientes" },
  { id: "accepted", label: "Aceptados" },
  { id: "rejected", label: "Rechazados" },
];

const EMPTY_LABEL: Record<string, string> = {
  pending: "pendientes",
  accepted: "aceptadas",
  rejected: "rechazadas",
};

export function PendingPage() {
  const [tab, setTab] = useState<string>("pending");
  const agentName = useAgentName();
  const { data, isLoading, isError, refetch } = usePendingProposals(tab);

  return (
    <PageLayout width="md" noPadding>
      <div className="px-5 pt-4 pb-5">
        <PageHeader
          title={`Pendientes de ${agentName}`}
          description={`Revisa y acepta las propuestas que ${agentName} generó desde audio o chat.`}
          className="mb-0"
        />
      </div>

      <Segmented items={TABS} value={tab} onChange={setTab} className="mb-5" />

      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {isError && (
        <div className="mx-5 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          No pude cargar la lista.
          <Button variant="ghost" size="sm" className="ml-2" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      )}

      {!isLoading && !isError && (data?.length ?? 0) === 0 && (
        <EmptyState
          title="Nada por aquí"
          description={`No hay propuestas ${EMPTY_LABEL[tab] ?? "pendientes"}.`}
        />
      )}

      {!isLoading && !isError && (data?.length ?? 0) > 0 && (
        <div className="space-y-3 px-5 pb-6">
          {data?.map((p) => (
            <AgentInlineProposalCard key={p.id} proposalId={p.id} />
          ))}
        </div>
      )}
    </PageLayout>
  );
}
