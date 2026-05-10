import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@shared/components/loading-spinner/loading-spinner";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@features/documents/api/http";

interface ApiProperty {
  id: string;
  title: string;
  address: string | null;
  status: string;
  is_draft: boolean;
  created_at: string;
}

export function AdminPropertiesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "properties"],
    queryFn: () => apiRequest<ApiProperty[]>("/v1/properties"),
  });

  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-6">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Propiedades</h1>
        <Button size="sm" disabled title="Crear/editar desde el dashboard de Anita por ahora">
          <Plus className="mr-1.5 size-4" /> Crear
        </Button>
      </header>

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
