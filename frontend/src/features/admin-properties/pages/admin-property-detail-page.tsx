import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@shared/components/loading-spinner/loading-spinner";
import { apiRequest } from "@features/documents/api/http";

interface ApiProperty {
  id: string;
  title: string;
  address: string | null;
  status: string;
}

interface ApiGrant {
  id: string;
  user_id: string;
  view: string;
  capabilities: string[];
}

export function AdminPropertyDetailPage() {
  const { id } = useParams<{ id: string }>();

  const propQ = useQuery({
    queryKey: ["admin", "property", id],
    queryFn: () => apiRequest<ApiProperty>(`/v1/properties/${id}`),
    enabled: !!id,
  });

  const grantsQ = useQuery({
    queryKey: ["admin", "property", id, "grants"],
    queryFn: () => apiRequest<ApiGrant[]>(`/v1/properties/${id}/grants`),
    enabled: !!id,
  });

  if (propQ.isLoading || !propQ.data) {
    return (
      <div className="flex flex-1 items-center justify-center py-16">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  const p = propQ.data;

  return (
    <div className="mx-auto w-full max-w-4xl p-4 sm:p-6">
      <Link
        to="/admin/properties"
        className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Volver
      </Link>

      <header className="mb-6">
        <h1 className="text-2xl font-bold">{p.title}</h1>
        {p.address && <p className="text-sm text-muted-foreground">{p.address}</p>}
        <Badge variant="outline" className="mt-1 text-[10px]">
          {p.status}
        </Badge>
      </header>

      <Tabs defaultValue="grants" className="w-full">
        <TabsList>
          <TabsTrigger value="grants">Accesos</TabsTrigger>
          <TabsTrigger value="docs">Documentos</TabsTrigger>
          <TabsTrigger value="visits">Visitas</TabsTrigger>
        </TabsList>

        <TabsContent value="grants" className="mt-4 space-y-2">
          {grantsQ.isLoading && (
            <div className="flex justify-center py-6">
              <LoadingSpinner size="sm" />
            </div>
          )}
          {(grantsQ.data ?? []).length === 0 && !grantsQ.isLoading && (
            <Card>
              <CardContent className="py-6 text-center text-sm text-muted-foreground">
                Sin accesos otorgados. Usá la sección Usuarios para otorgar.
              </CardContent>
            </Card>
          )}
          {(grantsQ.data ?? []).map((g) => (
            <Card key={g.id}>
              <CardContent className="flex items-center justify-between gap-3 py-3 text-sm">
                <Link
                  to={`/admin/users/${g.user_id}`}
                  className="font-medium underline-offset-2 hover:underline"
                >
                  {g.user_id.slice(0, 8)}…
                </Link>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  <Badge variant="outline" className="text-[10px]">
                    {g.view}
                  </Badge>
                  {g.capabilities.map((c) => (
                    <Badge key={c} variant="secondary" className="text-[10px]">
                      {c}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="docs" className="mt-4">
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              Listado de documentos linkeados — próximamente.
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="visits" className="mt-4">
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              Listado de visitas linkeadas — próximamente.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
