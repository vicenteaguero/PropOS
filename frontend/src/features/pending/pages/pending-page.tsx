import { useState } from "react";
import { AgentInlineProposalCard } from "@features/agent/components/agent-inline-proposal-card";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@shared/components/page-layout";
import { PageHeader } from "@shared/components/page-header";
import { EmptyState } from "@shared/components/empty-state/empty-state";
import {
  ErrorState,
  LoadMore,
  PageSkeleton,
  SectionLabel,
  Segmented,
  type SegmentedItem,
} from "@shared/ui";
import { useIsDesktop } from "@/hooks/use-mobile";
import { useDecidedProposals, useOldProposals, usePendingBucket } from "../hooks/use-pending";
import { useAgentName } from "@core/branding/agent-branding";
import type { PendingProposal } from "@features/agent/types";

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

  // Three slices, because one flat order either buries what is running out or
  // buries what just arrived. See the backend's `list_proposals`.
  const urgent = usePendingBucket("urgent");
  const recent = usePendingBucket("recent");
  // Nothing is fetched for the backlog until the broker asks for it.
  const [showOld, setShowOld] = useState(false);
  const old = useOldProposals(showOld);
  const decided = useDecidedProposals(tab === "accepted" ? "accepted" : "rejected");

  const isPendingTab = tab === "pending";
  const loading = isPendingTab ? urgent.isPending || recent.isPending : decided.isPending;
  const error = isPendingTab ? (urgent.error ?? recent.error) : decided.error;
  const refetch = () => {
    if (isPendingTab) {
      void urgent.refetch();
      void recent.refetch();
    } else void decided.refetch();
  };

  const urgentRows = urgent.data ?? [];
  const recentRows = recent.data ?? [];
  const oldRows = (old.data?.pages ?? []).flat();
  const decidedRows = (decided.data?.pages ?? []).flat();
  const count = isPendingTab
    ? urgentRows.length + recentRows.length + oldRows.length
    : decidedRows.length;

  const card = (p: PendingProposal) => (
    <AgentInlineProposalCard key={p.id} proposalId={p.id} proposal={p} />
  );

  const group = (title: string, rows: PendingProposal[]) =>
    rows.length > 0 && (
      <>
        <SectionLabel className={isDesktop ? "col-span-full" : undefined}>{title}</SectionLabel>
        {rows.map(card)}
      </>
    );

  const body = (
    <>
      {isPendingTab ? (
        <>
          {/* "Por vencer" first: these are the only ones that cost something to
              postpone. */}
          {group("Por vencer", urgentRows)}
          {group("Recientes", recentRows)}
          {showOld && group("Antiguos", oldRows)}
          {/* A real button, not a scroll sentinel: the backlog must load on a
              deliberate tap. Auto-loading it on scroll would fetch the pile the
              broker chose not to look at. */}
          {!showOld && (
            <div className={isDesktop ? "col-span-full py-2" : "py-2"}>
              <Button variant="outline" className="w-full" onClick={() => setShowOld(true)}>
                Ver antiguos
              </Button>
            </div>
          )}
        </>
      ) : (
        decidedRows.map(card)
      )}
    </>
  );

  const footer =
    isPendingTab && showOld && old.hasNextPage ? (
      <LoadMore
        onVisible={() => void old.fetchNextPage()}
        busy={old.isFetchingNextPage}
        label="Cargar más antiguos"
      />
    ) : !isPendingTab && decided.hasNextPage ? (
      <LoadMore onVisible={() => void decided.fetchNextPage()} busy={decided.isFetchingNextPage} />
    ) : null;

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

        {loading && <PageSkeleton variant="list" />}
        {error && <ErrorState message="No pude cargar la lista." onRetry={refetch} />}
        {!loading && !error && count === 0 && empty}
        {!loading && !error && count > 0 && (
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-3 [&>*]:self-start">{body}</div>
        )}
        {footer}
      </PageLayout>
    );
  }

  /**
   * Mobile: the filter IS the heading.
   *
   * This screen used to open with the shell's own bar reading "Pendientes",
   * then an h1 reading "Pendientes de Propo", then a full-width segmented
   * control — three stacked rows saying the same word before a single proposal
   * appeared, on the screen a push notification lands you in.
   */
  return (
    <PageLayout width="md" noPadding>
      <Segmented items={TABS} value={tab} onChange={setTab} className="mb-3" />

      {loading && <PageSkeleton variant="list" />}
      {error && (
        <ErrorState message="No pude cargar la lista." onRetry={refetch} className="mx-5" />
      )}
      {!loading && !error && count === 0 && empty}
      {!loading && !error && count > 0 && (
        <div className="space-y-2 px-[var(--page-x)] pb-6">{body}</div>
      )}
      {footer}
    </PageLayout>
  );
}

export default PendingPage;
