import { useMemo, useState } from "react";
import { useOpenOnParam } from "@shared/hooks/use-open-on-param";
import { useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  FilterSelect,
  ListCapNotice,
  ListShell,
  MasterDetail,
  Pill,
  PropertyFilter,
  Row,
} from "@shared/ui";
import { useProperties } from "@features/documents/hooks/use-entities";
import { useOpportunities } from "@features/opportunities/hooks/use-opportunities";
import { toast } from "sonner";
import { useContacts, useCreateContact } from "../hooks/use-contacts";
import { ContactFormDialog } from "../components/contact-form-dialog";
import { ContactDetail } from "../components/contact-detail";
import { CONTACT_TYPE_LABELS, CONTACT_TYPES, type ContactType } from "../types";
import { CONTACT_TYPE_TONES } from "@shared/lib/tones";
import { initials } from "@shared/utils/format";
import { DuplicateContacts } from "../components/duplicate-contacts";

/**
 * Personas — the CRM's centre of gravity.
 *
 * Opportunities and interactions used to be sibling tabs of this one, which
 * meant a broker looking at María had to leave her to see her deals and leave
 * again to see her calls. Both now live in `<ContactDetail>`'s own tabs, so the
 * person is the container and this page is only the way in.
 *
 * There is no `useIsDesktop()` fork here any more: `MasterDetail` already
 * collapses to a single column below md and swaps list → detail on selection,
 * which is the same push navigation the mobile branch was hand-rolling with a
 * route change. `/personas/:id` still exists for deep links.
 */
export function ContactsPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<ContactType | "ALL">("ALL");
  // "Everyone involved in THIS property" is the question a broker actually
  // asks; before this the only filter was the contact's type, which answers a
  // question nobody has.
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  useOpenOnParam("nuevo", () => setDialogOpen(true));

  // Selection lives in the URL, not in state. Below md the master-detail swaps
  // the list out for the detail, so a phone user's Back gesture has to land on
  // the list — with local state it exited the CRM entirely — and a link to a
  // person keeps working.
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("persona");
  const select = (id: string) => {
    const next = new URLSearchParams(params);
    next.set("persona", id);
    setParams(next);
  };
  const clearSelection = () => {
    const next = new URLSearchParams(params);
    next.delete("persona");
    setParams(next, { replace: true });
  };

  const { data, isLoading, error, refetch } = useContacts({ q: search || undefined, limit: 300 });
  const create = useCreateContact();
  const properties = useProperties();
  const opportunities = useOpportunities({ limit: 500 });

  /** People who have a deal on the selected property. */
  const peopleOnProperty = useMemo(() => {
    if (!propertyId) return null;
    const ids = new Set<string>();
    for (const o of opportunities.data ?? []) {
      if (o.property_id === propertyId && o.person_id) ids.add(o.person_id);
    }
    return ids;
  }, [opportunities.data, propertyId]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.filter((c) => {
      if (typeFilter !== "ALL" && c.type !== typeFilter) return false;
      if (peopleOnProperty && !peopleOnProperty.has(c.id)) return false;
      return true;
    });
  }, [data, typeFilter, peopleOnProperty]);

  const list = (
    <ListShell
      fill
      title="Personas"
      meta={filtered.length > 0 ? `${filtered.length}` : undefined}
      search={{
        value: search,
        onChange: setSearch,
        placeholder: "Nombre, teléfono o email",
        ariaLabel: "Buscar personas",
      }}
      action={
        <Button
          size="icon"
          aria-label="Nueva persona"
          className="rounded-full"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="size-4" strokeWidth={1.8} />
        </Button>
      }
      filters={
        // Two selects instead of eleven chips. As a chip row the type filter
        // scrolled sideways past the edge of a phone and there was no room to
        // add the property filter at all.
        <div className="flex flex-wrap items-center gap-2">
          <PropertyFilter
            properties={properties.data ?? []}
            value={propertyId}
            onChange={setPropertyId}
          />
          <FilterSelect
            label="Tipo"
            value={typeFilter === "ALL" ? null : typeFilter}
            onChange={(v) => setTypeFilter((v ?? "ALL") as ContactType | "ALL")}
            allLabel="Todos los tipos"
            options={CONTACT_TYPES.map((t) => ({ value: t, label: CONTACT_TYPE_LABELS[t] ?? t }))}
          />
        </div>
      }
      isLoading={isLoading}
      error={error}
      errorMessage="No se pudieron cargar los contactos."
      onRetry={() => refetch()}
      isEmpty={filtered.length === 0}
      emptyTitle={
        search || typeFilter !== "ALL" || propertyId ? "Sin coincidencias" : "Sin contactos"
      }
      emptyAction={{ label: "Nuevo contacto", onClick: () => setDialogOpen(true) }}
      footer={<ListCapNotice resource="contacts" count={data?.length} />}
    >
      {/* Above the list, not buried in settings: nobody goes looking for
          duplicates they do not know they have. */}
      <DuplicateContacts onMerged={() => refetch()} />

      {filtered.map((c, i) => (
        <Row
          key={c.id}
          onClick={() => select(c.id)}
          divider={i < filtered.length - 1}
          className={selectedId === c.id ? "bg-secondary/60" : undefined}
          left={
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-foreground">
              {initials(c.full_name)}
            </span>
          }
          title={c.full_name}
          sub={[c.phone, c.email].filter(Boolean).join(" · ") || "Sin datos de contacto"}
          right={<Pill tone={CONTACT_TYPE_TONES[c.type]}>{CONTACT_TYPE_LABELS[c.type]}</Pill>}
        />
      ))}
    </ListShell>
  );

  return (
    <>
      <MasterDetail
        selected={!!selectedId}
        list={list}
        detail={
          selectedId ? (
            <ContactDetail
              contactId={selectedId}
              onBack={clearSelection}
              onDeleted={clearSelection}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
              Selecciona una persona.
            </div>
          )
        }
      />
      <ContactFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={async (input) => {
          const created = await create.mutateAsync(input);
          toast.success("Contacto creado");
          select(created.id);
        }}
        pending={create.isPending}
      />
    </>
  );
}
