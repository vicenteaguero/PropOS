import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppShellScroll, ListCapNotice, ListShell } from "@shared/ui";
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

/**
 * Pipeline — the open deals as a board.
 *
 * The header used to be a `<PageHeader>` with no `title`, which still rendered
 * its `<h1>`: an empty heading reserving a line of vertical space above the
 * board and announcing nothing to a screen reader. The board is the page, so
 * the header now names it and carries the search and the create button on one
 * line with it.
 */
export function OpportunitiesPage() {
  const { data, isLoading, error, refetch } = useOpportunities({ status: "OPEN", limit: 500 });
  const { data: contacts } = useContacts({ limit: 500 });
  const create = useCreateOpportunity();
  const update = useUpdateOpportunity();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Opportunity | undefined>();
  const [search, setSearch] = useState("");

  const nameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of contacts ?? []) m.set(c.id, c.full_name);
    return m;
  }, [contacts]);

  const nameFor = (personId: string | null) =>
    personId ? (nameMap.get(personId) ?? "Sin contacto") : "Sin contacto";

  // Filtering the board rather than a list: with 100+ open deals, finding one
  // by eye means scanning six columns. The lanes stay, they just get shorter.
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data ?? [];
    return (data ?? []).filter((o) =>
      `${nameFor(o.person_id)} ${o.notes ?? ""}`.toLowerCase().includes(q),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nameFor is derived from nameMap
  }, [data, search, nameMap]);

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

  const openNew = () => {
    setEditing(undefined);
    setDialogOpen(true);
  };

  return (
    <AppShellScroll>
      <ListShell
        fill
        className="min-h-0 flex-1"
        title="Pipeline"
        meta={shown.length > 0 ? `${shown.length} abiertas` : undefined}
        search={{
          value: search,
          onChange: setSearch,
          placeholder: "Buscar por persona o nota",
          ariaLabel: "Buscar oportunidades",
        }}
        action={
          <Button size="sm" className="gap-1.5" onClick={openNew}>
            <Plus className="size-4" strokeWidth={1.8} />
            Nueva
          </Button>
        }
        skeleton="board"
        bodyPadding="page"
        isLoading={isLoading}
        error={error}
        errorMessage="No se pudo cargar el pipeline."
        onRetry={() => refetch()}
        isEmpty={shown.length === 0}
        emptyTitle={search ? "Sin coincidencias" : "Sin oportunidades abiertas"}
        emptyAction={search ? undefined : { label: "Nueva oportunidad", onClick: openNew }}
        footer={<ListCapNotice resource="opportunities" count={data?.length} className="mx-0" />}
      >
        {/* h-full so the board fills the pane and its columns scroll internally,
            instead of the pane scrolling a board taller than the viewport. */}
        <div className="h-full pb-2">
          <OpportunityKanban
            opportunities={shown}
            nameFor={nameFor}
            onMove={move}
            onWon={won}
            onLost={lost}
            onEdit={(opp) => {
              setEditing(opp);
              setDialogOpen(true);
            }}
          />
        </div>
      </ListShell>

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
    </AppShellScroll>
  );
}
