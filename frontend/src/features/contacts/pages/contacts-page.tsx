import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@shared/components/page-layout";
import { EmptyState } from "@shared/components/empty-state/empty-state";
import { useAuth } from "@shared/hooks/use-auth";
import { useIsDesktop } from "@/hooks/use-mobile";
import {
  Chip,
  Chips,
  ErrorState,
  ListCapNotice,
  MasterDetail,
  PageSkeleton,
  Pill,
  Row,
} from "@shared/ui";
import { toast } from "sonner";
import { useContacts, useCreateContact } from "../hooks/use-contacts";
import { ContactFormDialog } from "../components/contact-form-dialog";
import { ContactDetail } from "../components/contact-detail";
import { ContactAside } from "../components/contact-aside";
import { CONTACT_TYPE_LABELS, CONTACT_TYPES, type ContactType } from "../types";
import { CONTACT_TYPE_TONES } from "@shared/lib/tones";
import { initials } from "@shared/utils/format";
import { SearchInput } from "@shared/components/search-input/search-input";

export function ContactsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role.toLowerCase() ?? "agent";
  const isDesktop = useIsDesktop();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<ContactType | "ALL">("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  // Desktop master-detail selection. Mobile navigates instead (see openContact).
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useContacts({ q: search || undefined, limit: 300 });
  const create = useCreateContact();

  const filtered = useMemo(() => {
    if (!data) return [];
    return typeFilter === "ALL" ? data : data.filter((c) => c.type === typeFilter);
  }, [data, typeFilter]);

  // Mobile: push to the detail route. Desktop: select inline (no navigation).
  const openContact = (id: string) => {
    if (isDesktop) setSelectedId(id);
    else navigate(`/${role}/personas/${id}`);
  };

  const onCreated = (id: string) => {
    toast.success("Contacto creado");
    openContact(id);
  };

  // Shared list column: header, search, type filter, and the contact rows.
  const list = (
    <div className="pb-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
        <div>
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-foreground">
            Personas
          </h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {data ? `${data.length} contactos` : "Contactos del negocio"}
          </p>
        </div>
        <Button
          variant="ink"
          size="icon-lg"
          className="rounded-full"
          aria-label="Nuevo contacto"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="size-5" strokeWidth={1.8} />
        </Button>
      </div>

      {/* Search */}
      <div className="px-5 pb-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          className="lg:max-w-xl"
          ariaLabel="Buscar personas"
          placeholder="Buscar por nombre, teléfono o email"
          debounceMs={0}
        />
      </div>

      {/* Type filter */}
      <Chips className="px-5 pb-4">
        <Chip active={typeFilter === "ALL"} onClick={() => setTypeFilter("ALL")}>
          Todos
        </Chip>
        {CONTACT_TYPES.map((t) => (
          <Chip key={t} active={typeFilter === t} onClick={() => setTypeFilter(t)}>
            {CONTACT_TYPE_LABELS[t]}
          </Chip>
        ))}
      </Chips>

      {isLoading && <PageSkeleton variant="list" />}

      {error && (
        <ErrorState message="No se pudieron cargar los contactos." onRetry={() => refetch()} />
      )}

      {!isLoading && !error && filtered.length === 0 && (
        <div className="px-5">
          <EmptyState
            title="Sin contactos"
            description="Creá tu primer contacto o pedíselo a la IA por chat."
            actionLabel="Nuevo contacto"
            onAction={() => setDialogOpen(true)}
          />
        </div>
      )}

      <ListCapNotice resource="contacts" count={data?.length} />
      {!isLoading && !error && filtered.length > 0 && (
        <div>
          {filtered.map((c, i) => (
            <Row
              key={c.id}
              onClick={() => openContact(c.id)}
              divider={i < filtered.length - 1}
              className={isDesktop && selectedId === c.id ? "bg-secondary/60" : undefined}
              left={
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-foreground">
                  {initials(c.full_name)}
                </span>
              }
              title={c.full_name}
              sub={[c.phone, c.email].filter(Boolean).join(" · ") || "Sin contacto"}
              right={<Pill tone={CONTACT_TYPE_TONES[c.type]}>{CONTACT_TYPE_LABELS[c.type]}</Pill>}
            />
          ))}
        </div>
      )}
    </div>
  );

  const dialog = (
    <ContactFormDialog
      open={dialogOpen}
      onOpenChange={setDialogOpen}
      onSubmit={async (input) => {
        const created = await create.mutateAsync(input);
        onCreated(created.id);
      }}
      pending={create.isPending}
    />
  );

  // Desktop: master-detail. Selecting a row renders the detail inline; the
  // /personas/:id route stays available for deep-links via <ContactDetailPage>.
  if (isDesktop) {
    return (
      <>
        <MasterDetail
          selected={!!selectedId}
          list={list}
          detail={
            selectedId ? (
              <ContactDetail contactId={selectedId} onDeleted={() => setSelectedId(null)} />
            ) : (
              <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
                Seleccioná un contacto.
              </div>
            )
          }
          aside={selectedId ? <ContactAside contactId={selectedId} /> : undefined}
        />
        {dialog}
      </>
    );
  }

  // Mobile: unchanged — capped column, tapping a row pushes to the detail route.
  // The shared list already carries the bottom padding the page needs.
  return (
    <PageLayout width="md" noPadding>
      {list}
      {dialog}
    </PageLayout>
  );
}
