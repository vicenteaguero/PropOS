import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@shared/components/loading-spinner/loading-spinner";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { propertiesApi, type PropertyInput } from "../api/properties-api";
import { PropertyFormDialog } from "../components/property-form-dialog";

export function AdminPropertiesPage() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "properties"],
    queryFn: () => propertiesApi.list(),
  });
  const create = useMutation({
    mutationFn: (body: PropertyInput) => propertiesApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "properties"] }),
    onError: (err) => toast.error(err instanceof Error ? err.message : "No se pudo crear"),
  });

  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-6">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Propiedades</h1>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-1.5 size-4" /> Crear
        </Button>
      </header>

      <PropertyFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        pending={create.isPending}
        onSubmit={async (input) => {
          await create.mutateAsync(input);
          toast.success("Propiedad creada");
        }}
      />

      {isLoading && (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="md" />
        </div>
      )}

      <div className="space-y-2">
        {(data ?? []).map((p) => (
          <Link
            key={p.id}
            to={`/admin/properties/${p.id}`}
            className="block rounded-xl border border-border bg-card px-4 py-3 hover:bg-accent"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold">{p.title}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {p.status}
                  </Badge>
                  {p.is_draft && (
                    <Badge variant="secondary" className="text-[10px]">
                      draft
                    </Badge>
                  )}
                </div>
                {p.address && (
                  <div className="truncate text-xs text-muted-foreground">{p.address}</div>
                )}
              </div>
            </div>
          </Link>
        ))}
        {!isLoading && (data ?? []).length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No hay propiedades en este tenant.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
