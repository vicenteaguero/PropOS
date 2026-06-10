import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Plus, Search, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageLayout } from "@shared/components/page-layout";
import { PageHeader } from "@shared/components/page-header";
import { EmptyState } from "@shared/components/empty-state/empty-state";
import { useAuth } from "@shared/hooks/use-auth";
import { toast } from "sonner";
import { useContacts, useCreateContact } from "../hooks/use-contacts";
import { ContactFormDialog } from "../components/contact-form-dialog";
import { CONTACT_TYPE_LABELS, CONTACT_TYPES, type ContactType } from "../types";

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
    <PageLayout width="lg">
      <PageHeader
        title="Personas"
        description="Contactos del negocio: interesados, propietarios, proveedores y más."
        actions={
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="size-4" />
            Nuevo
          </Button>
        }
      />

      <div className="mb-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, teléfono o email"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge
            role="button"
            onClick={() => setTypeFilter("ALL")}
            variant="outline"
            className={
              typeFilter === "ALL" ? "cursor-pointer bg-primary/15 text-primary" : "cursor-pointer"
            }
          >
            Todos
          </Badge>
          {CONTACT_TYPES.map((t) => (
            <Badge
              key={t}
              role="button"
              onClick={() => setTypeFilter(t)}
              variant="outline"
              className={
                typeFilter === t ? "cursor-pointer bg-primary/15 text-primary" : "cursor-pointer"
              }
            >
              {CONTACT_TYPE_LABELS[t]}
            </Badge>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          No se pudieron cargar los contactos.
          <Button variant="ghost" size="sm" className="ml-2" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      )}

      {!isLoading && !error && filtered.length === 0 && (
        <EmptyState
          title="Sin contactos"
          description="Creá tu primer contacto o pedíselo a la IA por chat."
          actionLabel="Nuevo contacto"
          onAction={() => setDialogOpen(true)}
        />
      )}

      {!isLoading && !error && filtered.length > 0 && (
        <div className="divide-y rounded-lg border">
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => navigate(`/${role}/personas/${c.id}`)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                <UserRound className="size-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{c.full_name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {[c.phone, c.email].filter(Boolean).join(" · ") || "Sin contacto"}
                </div>
              </div>
              <Badge variant="outline" className="shrink-0 text-[10px]">
                {CONTACT_TYPE_LABELS[c.type]}
              </Badge>
            </button>
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
