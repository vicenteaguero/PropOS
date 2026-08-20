import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip, Chips, ListCapNotice, ListShell, MasterDetail, Pill, Row } from "@shared/ui";
import { toast } from "sonner";
import { useContacts, useCreateContact } from "../hooks/use-contacts";
import { ContactFormDialog } from "../components/contact-form-dialog";
import { ContactDetail } from "../components/contact-detail";
import { ContactAside } from "../components/contact-aside";
import { CONTACT_TYPE_LABELS, CONTACT_TYPES, type ContactType } from "../types";
import { CONTACT_TYPE_TONES } from "@shared/lib/tones";
import { initials } from "@shared/utils/format";

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
  const [dialogOpen, setDialogOpen] = useState(false);

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

  const filtered = useMemo(() => {
    if (!data) return [];
    return typeFilter === "ALL" ? data : data.filter((c) => c.type === typeFilter);
  }, [data, typeFilter]);

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
        <Button size="sm" className="gap-1.5" onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" strokeWidth={1.8} />
          Nueva
        </Button>
      }
      filters={
        <Chips>
          <Chip active={typeFilter === "ALL"} onClick={() => setTypeFilter("ALL")}>
            Todas
          </Chip>
          {CONTACT_TYPES.map((t) => (
            <Chip key={t} active={typeFilter === t} onClick={() => setTypeFilter(t)}>
              {CONTACT_TYPE_LABELS[t]}
            </Chip>
          ))}
        </Chips>
      }
      isLoading={isLoading}
      error={error}
      errorMessage="No se pudieron cargar los contactos."
      onRetry={() => refetch()}
      isEmpty={filtered.length === 0}
      emptyTitle={search || typeFilter !== "ALL" ? "Sin coincidencias" : "Sin contactos"}
      emptyAction={{ label: "Nuevo contacto", onClick: () => setDialogOpen(true) }}
      footer={<ListCapNotice resource="contacts" count={data?.length} />}
    >
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
        aside={selectedId ? <ContactAside contactId={selectedId} /> : undefined}
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
