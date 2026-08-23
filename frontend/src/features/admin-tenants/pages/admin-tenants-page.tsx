import { useState, type FormEvent } from "react";
import { cn } from "@/lib/utils";
import { Building2, Loader2, Plus } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLayout } from "@shared/components/page-layout";
import { EmptyState } from "@shared/components/empty-state/empty-state";
import {
  CONTROL_SQUARE,
  ListShell,
  ErrorState,
  PageSkeleton,
  Pill,
  ResponsiveSheet,
  ResponsiveTable,
  type ResponsiveColumn,
} from "@shared/ui";
import { useIsDesktop } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { apiRequest } from "@shared/api/http";

interface AdminTenant {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  member_count: number;
  property_count: number;
  created_at: string;
}

export function AdminTenantsPage() {
  const qc = useQueryClient();
  const isDesktop = useIsDesktop();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "tenants"],
    queryFn: () => apiRequest<AdminTenant[]>("/v1/admin/tenants"),
  });

  const create = useMutation({
    mutationFn: (body: { name: string; slug: string }) =>
      apiRequest<AdminTenant>("/v1/admin/tenants", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "tenants"] }),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      apiRequest(`/v1/admin/tenants/${id}`, { method: "PATCH", body: { is_active } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "tenants"] }),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    try {
      await create.mutateAsync({ name: name.trim(), slug: slug.trim().toLowerCase() });
      toast.success("Tenant creado.");
      setName("");
      setSlug("");
      setCreateOpen(false);
    } catch (err) {
      toast.error(`Error: ${err instanceof Error ? err.message : "desconocido"}`);
    }
  }

  const tenants = data ?? [];

  const toggleBtn = (t: AdminTenant) => (
    <Button
      size="sm"
      variant={t.is_active ? "outline" : "ink"}
      className="shrink-0 rounded-full"
      disabled={toggleActive.isPending}
      onClick={() => toggleActive.mutate({ id: t.id, is_active: !t.is_active })}
    >
      {t.is_active ? "Desactivar" : "Reactivar"}
    </Button>
  );

  // Desktop: a dense table that uses the full width.
  const table = (
    <ResponsiveTable
      rows={tenants}
      rowKey={(t) => t.id}
      columns={
        [
          {
            key: "tenant",
            header: "Tenant",
            cell: (t) => (
              <span className="flex items-center gap-2.5 font-medium text-foreground">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                  <Building2 className="size-4" strokeWidth={1.8} />
                </span>
                <span className="truncate">{t.name}</span>
              </span>
            ),
          },
          { key: "slug", header: "Slug", cell: (t) => <Pill tone="neutral">{t.slug}</Pill> },
          {
            key: "miembros",
            header: "Miembros",
            className: "tabular-nums text-muted-foreground",
            cell: (t) => t.member_count,
          },
          {
            key: "propiedades",
            header: "Propiedades",
            className: "tabular-nums text-muted-foreground",
            cell: (t) => t.property_count,
          },
          {
            key: "estado",
            header: "Estado",
            cell: (t) =>
              t.is_active ? (
                <Pill tone="success">Activo</Pill>
              ) : (
                <Pill tone="destructive">Inactivo</Pill>
              ),
          },
          { key: "acciones", header: "", align: "right", cell: (t) => toggleBtn(t) },
        ] as ResponsiveColumn<AdminTenant>[]
      }
      mobileRow={(t: AdminTenant) => ({
        left: (
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground">
            <Building2 className="size-[18px]" strokeWidth={1.8} />
          </span>
        ),
        title: (
          <span className="flex items-center gap-2">
            <span className="truncate">{t.name}</span>
            <Pill tone="neutral">{t.slug}</Pill>
            {!t.is_active && <Pill tone="destructive">Inactivo</Pill>}
          </span>
        ),
        sub: `${t.member_count} miembros · ${t.property_count} propiedades`,
        right: toggleBtn(t),
      })}
    />
  );

  return (
    <PageLayout width="app" noPadding className="mx-auto max-w-2xl pb-6 lg:max-w-none">
      {/* Header */}
      <ListShell
        titleSr="Tenants"
        primaryAction={
          <Button
            variant="ink"
            size="icon"
            className={cn("rounded-full", CONTROL_SQUARE)}
            aria-label="Crear tenant"
            title="Crear tenant"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="size-4" strokeWidth={1.8} />
          </Button>
        }
      />

      {isLoading && <PageSkeleton variant={isDesktop ? "table" : "list"} />}
      {error && (
        <ErrorState message="No se pudieron cargar los tenants." onRetry={() => refetch()} />
      )}

      {!isLoading && !error && tenants.length === 0 && (
        <div className="px-[var(--page-x)] lg:px-8">
          <EmptyState
            title="Sin tenants"
            description="Crea el primer espacio de trabajo."
            actionLabel="Crear tenant"
            onAction={() => setCreateOpen(true)}
          />
        </div>
      )}

      {!isLoading && !error && tenants.length > 0 && <div className="lg:px-8">{table}</div>}

      <ResponsiveSheet open={createOpen} onOpenChange={setCreateOpen} title="Nuevo tenant">
        <form onSubmit={handleCreate} className="mt-4 space-y-3">
          <div className="grid gap-1.5">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" value={name} required onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="slug">Slug (a-z, 0-9, guiones)</Label>
            <Input
              id="slug"
              value={slug}
              required
              pattern="^[a-z0-9][a-z0-9-]*$"
              onChange={(e) => setSlug(e.target.value)}
            />
          </div>
          <Button type="submit" variant="ink" size="block" disabled={create.isPending}>
            {create.isPending ? <Loader2 className="size-4 animate-spin" /> : "Crear"}
          </Button>
        </form>
      </ResponsiveSheet>
    </PageLayout>
  );
}
