import { useState, type FormEvent } from "react";
import { Building2, Loader2, Plus } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLayout } from "@shared/components/page-layout";
import { EmptyState } from "@shared/components/empty-state/empty-state";
import { ErrorState, PageSkeleton, Pill, ResponsiveSheet, Row } from "@shared/ui";
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
  const desktopTable = (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th className="px-4 py-3 font-medium">Tenant</th>
            <th className="px-4 py-3 font-medium">Slug</th>
            <th className="px-4 py-3 font-medium whitespace-nowrap">Miembros</th>
            <th className="px-4 py-3 font-medium whitespace-nowrap">Propiedades</th>
            <th className="px-4 py-3 font-medium">Estado</th>
            <th className="w-px px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {tenants.map((t) => (
            <tr key={t.id} className="border-b border-border last:border-0 hover:bg-secondary/40">
              <td className="px-4 py-3">
                <span className="flex items-center gap-2.5 font-medium text-foreground">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                    <Building2 className="size-4" strokeWidth={1.8} />
                  </span>
                  <span className="truncate">{t.name}</span>
                </span>
              </td>
              <td className="px-4 py-3">
                <Pill tone="neutral">{t.slug}</Pill>
              </td>
              <td className="px-4 py-3 tabular-nums text-muted-foreground">{t.member_count}</td>
              <td className="px-4 py-3 tabular-nums text-muted-foreground">{t.property_count}</td>
              <td className="px-4 py-3">
                {t.is_active ? (
                  <Pill tone="success">Activo</Pill>
                ) : (
                  <Pill tone="destructive">Inactivo</Pill>
                )}
              </td>
              <td className="px-4 py-3 text-right">{toggleBtn(t)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // Mobile: stacked Row list (unchanged).
  const mobileList = (
    <div>
      {tenants.map((t, i) => (
        <Row
          key={t.id}
          divider={i < tenants.length - 1}
          left={
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground">
              <Building2 className="size-[18px]" strokeWidth={1.8} />
            </span>
          }
          title={
            <span className="flex items-center gap-2">
              <span className="truncate">{t.name}</span>
              <Pill tone="neutral">{t.slug}</Pill>
              {!t.is_active && <Pill tone="destructive">Inactivo</Pill>}
            </span>
          }
          sub={`${t.member_count} miembros · ${t.property_count} propiedades`}
          right={toggleBtn(t)}
        />
      ))}
    </div>
  );

  return (
    <PageLayout width="app" noPadding className="mx-auto max-w-2xl pb-6 lg:max-w-none">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 lg:px-8 lg:pt-7">
        <div>
          <h1 className="text-[17px] font-semibold leading-tight tracking-tight text-foreground">
            Tenants
          </h1>
        </div>
        <Button
          variant="ink"
          size="icon-lg"
          className="rounded-full"
          aria-label="Crear tenant"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="size-5" strokeWidth={1.8} />
        </Button>
      </div>

      {isLoading && <PageSkeleton variant="table" />}
      {error && (
        <ErrorState message="No se pudieron cargar los tenants." onRetry={() => refetch()} />
      )}

      {!isLoading && !error && tenants.length === 0 && (
        <div className="px-5 lg:px-8">
          <EmptyState
            title="Sin tenants"
            description="Crea el primer espacio de trabajo."
            actionLabel="Crear tenant"
            onAction={() => setCreateOpen(true)}
          />
        </div>
      )}

      {!isLoading && !error && tenants.length > 0 && (
        <div className="lg:px-8">{isDesktop ? desktopTable : mobileList}</div>
      )}

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
