import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@shared/components/page-layout";
import { EmptyState } from "@shared/components/empty-state/empty-state";
import { useAuth } from "@shared/hooks/use-auth";
import { Chip, Chips, Pill, Row, type PillTone } from "@shared/ui";
import { toast } from "sonner";
import { useContacts, useCreateContact } from "../hooks/use-contacts";
import { ContactFormDialog } from "../components/contact-form-dialog";
import { CONTACT_TYPE_LABELS, CONTACT_TYPES, type ContactType } from "../types";

/** Soft tone per contact type (semantic tokens only). */
const TYPE_TONE: Record<ContactType, PillTone> = {
  BUYER: "accent",
  SELLER: "success",
  LANDOWNER: "warning",
  NOTARY: "neutral",
  INVESTOR: "accent",
  EMPLOYEE: "neutral",
  FAMILY: "neutral",
  VENDOR: "neutral",
  STAKEHOLDER: "neutral",
  OTHER: "neutral",
};

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function ContactsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role.toLowerCase() ?? "agent";
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<ContactType | "ALL">("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, isLoading, error, refetch } = useContacts({ q: search || undefined, limit: 300 });
  const create = useCreateContact();

  const filtered = useMemo(() => {
    if (!data) return [];
    return typeFilter === "ALL" ? data : data.filter((c) => c.type === typeFilter);
  }, [data, typeFilter]);

  return (
    <PageLayout width="md" noPadding className="pb-6">
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
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground"
            strokeWidth={1.8}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, teléfono o email"
            className="h-12 w-full rounded-full border border-border bg-secondary pl-11 pr-4 text-[15px] text-foreground placeholder:text-muted-foreground focus-visible:border-line-strong focus-visible:outline-none"
          />
        </div>
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

      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className="mx-5 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          No se pudieron cargar los contactos.
          <Button variant="ghost" size="sm" className="ml-2" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
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

      {!isLoading && !error && filtered.length > 0 && (
        <div>
          {filtered.map((c, i) => (
            <Row
              key={c.id}
              onClick={() => navigate(`/${role}/personas/${c.id}`)}
              divider={i < filtered.length - 1}
              left={
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-foreground">
                  {initials(c.full_name)}
                </span>
              }
              title={c.full_name}
              sub={[c.phone, c.email].filter(Boolean).join(" · ") || "Sin contacto"}
              right={<Pill tone={TYPE_TONE[c.type]}>{CONTACT_TYPE_LABELS[c.type]}</Pill>}
            />
          ))}
        </div>
      )}

      <ContactFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={async (input) => {
          const created = await create.mutateAsync(input);
          toast.success("Contacto creado");
          navigate(`/${role}/personas/${created.id}`);
        }}
        pending={create.isPending}
      />
    </PageLayout>
  );
}
