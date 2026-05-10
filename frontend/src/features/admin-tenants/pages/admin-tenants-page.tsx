import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { LoadingSpinner } from "@shared/components/loading-spinner/loading-spinner";
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
  const { data, isLoading, error } = useQuery({
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

  return (
    <div className="mx-auto w-full max-w-4xl p-4 sm:p-6">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tenants</h1>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 size-4" /> Crear tenant
        </Button>
      </header>

      {isLoading && (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="md" />
        </div>
      )}
      {error && (
        <Card>
          <CardContent className="py-6 text-center text-sm text-destructive">
            Error al cargar.
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {(data ?? []).map((t) => (
          <Card key={t.id}>
            <CardContent className="flex items-center justify-between gap-3 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{t.name}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {t.slug}
                  </Badge>
                  {!t.is_active && (
                    <Badge variant="destructive" className="text-[10px]">
                      Inactivo
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t.member_count} miembros · {t.property_count} propiedades
                </div>
              </div>
              <Button
                size="sm"
                variant={t.is_active ? "outline" : "default"}
                onClick={() => toggleActive.mutate({ id: t.id, is_active: !t.is_active })}
              >
                {t.is_active ? "Desactivar" : "Reactivar"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Nuevo tenant</SheetTitle>
          </SheetHeader>
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
            <Button type="submit" disabled={create.isPending} className="w-full">
              {create.isPending ? <LoadingSpinner size="sm" /> : "Crear"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
