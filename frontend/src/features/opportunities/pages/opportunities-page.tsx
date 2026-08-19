import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@shared/components/page-layout";
import { PageHeader } from "@shared/components/page-header";
import { EmptyState } from "@shared/components/empty-state/empty-state";
import { AppShellScroll, ErrorState, ListCapNotice, PageSkeleton } from "@shared/ui";
import { toast } from "sonner";
import { useContacts } from "@features/contacts/hooks/use-contacts";
import {
  useCreateOpportunity,
  useOpportunities,
  useUpdateOpportunity,
} from "../hooks/use-opportunities";
import { OpportunityKanban } from "../components/opportunity-kanban";
import { OpportunityFormDialog } from "../components/opportunity-form-dialog";
import type { Opportunity } from "../types";

export function OpportunitiesPage() {
  const { data, isLoading, error, refetch } = useOpportunities({ status: "OPEN", limit: 500 });
  const { data: contacts } = useContacts({ limit: 500 });
  const create = useCreateOpportunity();
  const update = useUpdateOpportunity();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Opportunity | undefined>();

  const nameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of contacts ?? []) m.set(c.id, c.full_name);
    return m;
  }, [contacts]);

  const nameFor = (personId: string | null) =>
    personId ? (nameMap.get(personId) ?? "Sin contacto") : "Sin contacto";

  const move = (id: string, stage: string) =>
    update.mutate({ id, body: { pipeline_stage: stage } });
  const won = (opp: Opportunity) => {
    update.mutate({ id: opp.id, body: { status: "WON" } });
    toast.success("Oportunidad ganada");
  };
  const lost = (opp: Opportunity) => {
    update.mutate({ id: opp.id, body: { status: "LOST" } });
    toast("Oportunidad marcada como perdida");
  };

  return (
    <PageLayout width="app" noPadding>
      <AppShellScroll>
        {/* Fixed header on desktop; normal flow on mobile. */}
        <div className="shrink-0 px-4 py-6 md:px-6 md:py-8 lg:px-8 lg:pb-4 lg:pt-7">
          <PageHeader
            title="Oportunidades"
            description="Pipeline de ventas y arriendos. Arrastrá las tarjetas para cambiar de etapa."
            className="mb-0"
            actions={
              <Button
                onClick={() => {
                  setEditing(undefined);
                  setDialogOpen(true);
                }}
                className="gap-2"
              >
                <Plus className="size-4" />
                Nueva
              </Button>
            }
          />
        </div>

        {/* Board region: fills remaining height on desktop, internal column scroll. */}
        <div className="px-4 md:px-6 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:px-8 lg:pb-6">
          {isLoading && <PageSkeleton variant="cards" />}
          {error && (
            <ErrorState message="No se pudo cargar el pipeline." onRetry={() => refetch()} />
          )}
          {!isLoading && !error && (data?.length ?? 0) === 0 && (
            <EmptyState
              title="Sin oportunidades abiertas"
              description="Creá una oportunidad para empezar a hacer seguimiento del pipeline."
              actionLabel="Nueva oportunidad"
              onAction={() => {
                setEditing(undefined);
                setDialogOpen(true);
              }}
            />
          )}
          <ListCapNotice resource="opportunities" count={data?.length} className="mx-0" />
          {!isLoading && !error && data && data.length > 0 && (
            <OpportunityKanban
              opportunities={data}
              nameFor={nameFor}
              onMove={move}
              onWon={won}
              onLost={lost}
              onEdit={(opp) => {
                setEditing(opp);
                setDialogOpen(true);
              }}
            />
          )}
        </div>
      </AppShellScroll>

      <OpportunityFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        opportunity={editing}
        pending={create.isPending || update.isPending}
        onSubmit={async (input) => {
          if (editing) {
            await update.mutateAsync({ id: editing.id, body: input });
            toast.success("Oportunidad actualizada");
          } else {
            await create.mutateAsync(input);
            toast.success("Oportunidad creada");
          }
        }}
      />
    </PageLayout>
  );
}
