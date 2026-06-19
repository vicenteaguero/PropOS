import { useState, type FormEvent } from "react";
import { Building2, Loader2, Plus } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLayout } from "@shared/components/page-layout";
import { EmptyState } from "@shared/components/empty-state/empty-state";
import { BottomSheet, Pill, Row } from "@shared/ui";
import { toast } from "sonner";
import { apiRequest } from "@features/documents/api/http";

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

  return (
    <PageLayout width="md" noPadding className="pb-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
        <div>
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-foreground">
            Tenants
          </h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {data ? `${tenants.length} tenants` : "Espacios de trabajo de la plataforma"}
          </p>
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

      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {error && (
        <div className="mx-5 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          No se pudieron cargar los tenants.
          <Button variant="ghost" size="sm" className="ml-2" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      )}

      {!isLoading && !error && tenants.length === 0 && (
        <div className="px-5">
          <EmptyState
            title="Sin tenants"
            description="Creá el primer espacio de trabajo."
            actionLabel="Crear tenant"
            onAction={() => setCreateOpen(true)}
          />
        </div>
      )}

      {!isLoading && !error && tenants.length > 0 && (
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
              right={
                <Button
                  size="sm"
                  variant={t.is_active ? "outline" : "ink"}
                  className="shrink-0 rounded-full"
                  disabled={toggleActive.isPending}
                  onClick={() => toggleActive.mutate({ id: t.id, is_active: !t.is_active })}
                >
                  {t.is_active ? "Desactivar" : "Reactivar"}
                </Button>
              }
            />
          ))}
        </div>
      )}

      <BottomSheet open={createOpen} onOpenChange={setCreateOpen} title="Nuevo tenant">
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
      </BottomSheet>
    </PageLayout>
  );
}
