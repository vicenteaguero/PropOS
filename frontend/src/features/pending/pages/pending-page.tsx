import { useState } from "react";
import { AgentInlineProposalCard } from "@features/agent/components/agent-inline-proposal-card";
import { PageLayout } from "@shared/components/page-layout";
import { PageHeader } from "@shared/components/page-header";
import { EmptyState } from "@shared/components/empty-state/empty-state";
import { ErrorState, PageSkeleton, Segmented, type SegmentedItem } from "@shared/ui";
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

  const loading = <PageSkeleton variant="list" />;

  const errorBox = <ErrorState message="No pude cargar la lista." onRetry={() => refetch()} />;

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
          <PageHeader title={`Pendientes de ${agentName}`} className="mb-0" />
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
              <AgentInlineProposalCard key={p.id} proposalId={p.id} proposal={p} />
            ))}
          </div>
        )}
      </PageLayout>
    );
  }

  /**
   * Mobile: the filter IS the heading.
   *
   * This screen used to open with the shell's own bar reading "Pendientes",
   * then an h1 reading "Pendientes de Propo", then a full-width segmented
   * control — three stacked rows saying the same word before a single proposal
   * appeared, on the screen a push notification lands you in. The shell bar
   * already names the page and now carries a back control, so the page starts
   * at the one control that changes what is on it.
   */
  return (
    <PageLayout width="md" noPadding>
      <Segmented items={TABS} value={tab} onChange={setTab} className="mb-3" />

      {isLoading && loading}

      {isError && (
        <ErrorState message="No pude cargar la lista." onRetry={() => refetch()} className="mx-5" />
      )}

      {!isLoading && !isError && count === 0 && empty}

      {!isLoading && !isError && count > 0 && (
        <div className="space-y-2 px-[var(--page-x)] pb-6">
          {data?.map((p) => (
            <AgentInlineProposalCard key={p.id} proposalId={p.id} proposal={p} />
          ))}
        </div>
      )}
    </PageLayout>
  );
}
