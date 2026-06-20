import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AgentInlineProposalCard } from "@features/agent/components/agent-inline-proposal-card";
import { PageLayout } from "@shared/components/page-layout";
import { PageHeader } from "@shared/components/page-header";
import { EmptyState } from "@shared/components/empty-state/empty-state";
import { Segmented, type SegmentedItem } from "@shared/ui";
import { useIsDesktop } from "@/hooks/use-mobile";
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
  const isDesktop = useIsDesktop();
  const { data, isLoading, isError, refetch } = usePendingProposals(tab);

  const count = data?.length ?? 0;

  const loading = (
    <div className="flex justify-center py-12">
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
    </div>
  );

  const errorBox = (
    <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
      No pude cargar la lista.
      <Button variant="ghost" size="sm" className="ml-2" onClick={() => refetch()}>
        Reintentar
      </Button>
    </div>
  );

  const empty = (
    <EmptyState
      title="Nada por aquí"
      description={`No hay propuestas ${EMPTY_LABEL[tab] ?? "pendientes"}.`}
    />
  );

  // Desktop: full-width app surface, inline tabs in the header row, and the
  // proposal cards flow into a multi-column masonry-ish grid instead of a
  // single capped column. Each card is self-contained so it tiles cleanly.
  if (isDesktop) {
    return (
      <PageLayout width="app">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <PageHeader
            title={`Pendientes de ${agentName}`}
            description={`Revisa y acepta las propuestas que ${agentName} generó desde audio o chat.`}
            className="mb-0"
          />
          <Segmented
            items={TABS}
            value={tab}
            onChange={setTab}
            className="shrink-0 border-b-0 px-0"
          />
        </div>

        {isLoading && loading}
        {isError && errorBox}
        {!isLoading && !isError && count === 0 && empty}
        {!isLoading && !isError && count > 0 && (
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-3 [&>*]:self-start">
            {data?.map((p) => (
              <AgentInlineProposalCard key={p.id} proposalId={p.id} />
            ))}
          </div>
        )}
      </PageLayout>
    );
  }

  // Mobile: unchanged — capped column, full-width segmented control, stacked cards.
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

      {isLoading && loading}

      {isError && (
        <div className="mx-5 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          No pude cargar la lista.
          <Button variant="ghost" size="sm" className="ml-2" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      )}

      {!isLoading && !isError && count === 0 && empty}

      {!isLoading && !isError && count > 0 && (
        <div className="space-y-3 px-5 pb-6">
          {data?.map((p) => (
            <AgentInlineProposalCard key={p.id} proposalId={p.id} />
          ))}
        </div>
      )}
    </PageLayout>
  );
}
