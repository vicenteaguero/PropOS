import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProperties } from "@features/documents/hooks/use-entities";
import { ArrowUpDown, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ActionIcon,
  AppShellScroll,
  CONTROL_SQUARE,
  ListCapNotice,
  ListShell,
  FilterSelect,
} from "@shared/ui";
import { toast } from "sonner";
import { useAuth } from "@shared/hooks/use-auth";
import { useIsDesktop } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useContacts } from "@features/contacts/hooks/use-contacts";
import {
  useCreateOpportunity,
  useOpportunities,
  useUpdateOpportunity,
} from "../hooks/use-opportunities";
import { OpportunityKanban } from "../components/opportunity-kanban";
import { OpportunityStageList } from "../components/opportunity-stage-list";
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
type DealOrder = "stage" | "value" | "age";

const DEAL_ORDERS: { value: DealOrder; label: string; sub: string }[] = [
  { value: "stage", label: "Por etapa", sub: "El orden del pipeline" },
  { value: "value", label: "Monto", sub: "Los más grandes primero" },
  { value: "age", label: "Antigüedad", sub: "Los que llevan más tiempo sin moverse" },
];

export function OpportunitiesPage() {
  const { data, isLoading, error, refetch } = useOpportunities({ status: "OPEN", limit: 500 });
  const { data: contacts } = useContacts({ limit: 500 });
  const create = useCreateOpportunity();
  const update = useUpdateOpportunity();

  // Create only. Editing moved to the deal's own page, which is the only
  // surface with room for its people, its properties and its file.
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [comuna, setComuna] = useState<string | null>(null);
  const [order, setOrder] = useState<DealOrder>("stage");

  const properties = useProperties();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const { user } = useAuth();
  const role = (user?.role ?? "ADMIN").toLowerCase();

  const nameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of contacts ?? []) m.set(c.id, c.full_name);
    return m;
  }, [contacts]);

  const nameFor = (personId: string | null) =>
    personId ? (nameMap.get(personId) ?? "Sin contacto") : "Sin contacto";

  const propertyMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of properties.data ?? []) if (p.title) m.set(p.id, p.title);
    return m;
  }, [properties.data]);

  const propertyFor = (propertyId: string | null) =>
    propertyId ? (propertyMap.get(propertyId) ?? null) : null;

  // Straight off the row. This used to be built from `useProperties()`, which
  // returns 100 properties against 500 deals — so `comunaMap` was mostly empty
  // and every deal fell into "Sin comuna", which is indistinguishable from a
  // broken filter, because it was one.
  const comunaFor = (opp: Opportunity) => opp.comunas?.[0] ?? null;

  /** Every comuna present in the current book, for the filter's options. */
  const comunas = useMemo(() => {
    const seen = new Set<string>();
    for (const o of data ?? []) for (const c of o.comunas ?? []) seen.add(c);
    return [...seen].sort((a, b) => a.localeCompare(b, "es"));
  }, [data]);

  // Filtering the board rather than a list: with 100+ open deals, finding one
  // by eye means scanning six columns. The lanes stay, they just get shorter.
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = data ?? [];
    if (comuna) rows = rows.filter((o) => (o.comunas ?? []).includes(comuna));
    if (q) {
      rows = rows.filter((o) =>
        `${nameFor(o.person_id)} ${propertyFor(o.property_id) ?? ""} ${o.notes ?? ""}`
          .toLowerCase()
          .includes(q),
      );
    }
    if (order === "value") {
      rows = [...rows].sort(
        (a, b) => (b.expected_value_cents ?? 0) - (a.expected_value_cents ?? 0),
      );
    } else if (order === "age") {
      // Oldest first: the point of ordering by age is to surface what has been
      // sitting untouched, not to re-show what you created this morning.
      rows = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));
    }
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nameFor is derived from nameMap
  }, [data, search, comuna, order, nameMap, propertyMap]);

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

  const openNew = () => setDialogOpen(true);

  return (
    <AppShellScroll>
      <ListShell
        fill
        className="min-h-0 flex-1"
        // The section tab already reads "Negocios"; the count moved onto the
        // stage the broker is actually looking at, where it means something.
        titleSr="Negocios"
        search={{
          value: search,
          onChange: setSearch,
          placeholder: "Buscar negocio…",
          ariaLabel: "Buscar oportunidades",
        }}
        action={
          <>
            {/* Propiedades stopped being a headline tab (see
                SectionTab.secondary); a deal is about a property, so this is the
                view that owns the door to the catalogue — the same move
                Conversaciones makes for Personas, in the same slot. */}
            <Button
              size="icon"
              variant="outline"
              aria-label="Ver propiedades"
              title="Ver propiedades"
              className={cn("rounded-full", CONTROL_SQUARE)}
              onClick={() => navigate(`/${role}/propiedades`)}
            >
              <Building2 className="size-4" strokeWidth={1.8} />
            </Button>
          </>
        }
        filters={
          // On BOTH branches. The comuna control existed only in the phone's
          // stage list, so the laptop — where the board is widest and the
          // filter most useful — did not have it at all.
          <div className="flex items-center gap-2">
            <FilterSelect
              label="Comuna"
              value={comuna}
              allLabel="Todas"
              options={comunas.map((c) => ({ value: c, label: c }))}
              onChange={setComuna}
            />
            <FilterSelect
              iconOnly
              icon={<ArrowUpDown className="size-4" strokeWidth={1.9} />}
              label="Ordenar"
              value={order}
              options={DEAL_ORDERS.map((o) => ({ value: o.value, label: o.label, sub: o.sub }))}
              onChange={(v) => setOrder((v as DealOrder) ?? "stage")}
            />
          </div>
        }
        primaryAction={
          <Button
            size="icon"
            aria-label="Nuevo negocio"
            className={cn("rounded-full", CONTROL_SQUARE)}
            onClick={openNew}
          >
            <ActionIcon name="createDeal" />
          </Button>
        }
        skeleton="board"
        bodyPadding="page"
        isLoading={isLoading}
        error={error}
        errorMessage="No se pudo cargar el pipeline."
        onRetry={() => refetch()}
        isEmpty={shown.length === 0}
        emptyTitle={search ? "Sin coincidencias" : "Sin negocios abiertos"}
        emptyAction={search ? undefined : { label: "Nueva oportunidad", onClick: openNew }}
        footer={<ListCapNotice resource="opportunities" count={data?.length} className="mx-0" />}
      >
        {/* h-full so the board fills the pane and its columns scroll internally,
            instead of the pane scrolling a board taller than the viewport. */}
        <div className="flex h-full min-h-0 flex-col pb-2">
          {isDesktop ? (
            <OpportunityKanban
              opportunities={shown}
              nameFor={nameFor}
              propertyFor={propertyFor}
              onMove={move}
              onWon={won}
              onLost={lost}
              // The card opens the deal's own page rather than a modal: a
              // modal has nowhere to put participants, the properties it
              // touches, or the file it becomes after the handshake.
              onEdit={(opp) => navigate(`/${role}/negocios/${opp.id}`)}
            />
          ) : (
            <OpportunityStageList
              opportunities={shown}
              nameFor={nameFor}
              propertyFor={propertyFor}
              comunaFor={comunaFor}
              onMove={move}
              onWon={won}
              onLost={lost}
              onOpen={(opp) => navigate(`/${role}/negocios/${opp.id}`)}
            />
          )}
        </div>
      </ListShell>

      <OpportunityFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        pending={create.isPending}
        onSubmit={async (input) => {
          await create.mutateAsync(input);
          toast.success("Negocio creado");
        }}
      />
    </AppShellScroll>
  );
}
