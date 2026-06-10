import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Copy, Pencil, Sparkles } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LoadingSpinner } from "@shared/components/loading-spinner/loading-spinner";
import { apiRequest } from "@features/documents/api/http";
import { toast } from "sonner";
import { propertiesApi, type PropertyInput } from "../api/properties-api";
import { PropertyFormDialog } from "../components/property-form-dialog";

interface ApiGrant {
  id: string;
  user_id: string;
  view: string;
  capabilities: string[];
}

function clp(cents: number | null): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function AdminPropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);

  const propQ = useQuery({
    queryKey: ["admin", "property", id],
    queryFn: () => propertiesApi.get(id as string),
    enabled: !!id,
  });
  const grantsQ = useQuery({
    queryKey: ["admin", "property", id, "grants"],
    queryFn: () => apiRequest<ApiGrant[]>(`/v1/properties/${id}/grants`),
    enabled: !!id,
  });
  const update = useMutation({
    mutationFn: (body: Partial<PropertyInput>) => propertiesApi.update(id as string, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "property", id] }),
    onError: (err) => toast.error(err instanceof Error ? err.message : "No se pudo guardar"),
  });
  const generate = useMutation({
    mutationFn: () => propertiesApi.generateDescription(id as string, "profesional", "generic"),
    onSuccess: (r) => setDraft(r.description),
    onError: (err) => toast.error(err instanceof Error ? err.message : "No se pudo generar"),
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

      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{p.title}</h1>
          {p.address && <p className="text-sm text-muted-foreground">{p.address}</p>}
          <Badge variant="outline" className="mt-1 text-[10px]">
            {p.status}
          </Badge>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => setEditOpen(true)}>
          <Pencil className="size-4" /> Editar
        </Button>
      </header>

      <Tabs defaultValue="ficha" className="w-full">
        <TabsList>
          <TabsTrigger value="ficha">Ficha</TabsTrigger>
          <TabsTrigger value="descripcion">Descripción IA</TabsTrigger>
          <TabsTrigger value="grants">Accesos</TabsTrigger>
        </TabsList>

        <TabsContent value="ficha" className="mt-4">
          <Card>
            <CardContent className="grid grid-cols-2 gap-x-6 gap-y-2 pt-6 text-sm sm:grid-cols-3">
              <div>
                <div className="text-xs text-muted-foreground">Operación</div>
                {p.listing_kind}
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Precio</div>
                {clp(p.list_price_cents)}
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Dormitorios</div>
                {p.bedrooms ?? "—"}
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Baños</div>
                {p.bathrooms ?? "—"}
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Superficie</div>
                {p.area_sqm != null ? `${p.area_sqm} m²` : "—"}
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Año</div>
                {p.year_built ?? "—"}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="descripcion" className="mt-4 space-y-3">
          <div className="flex gap-2">
            <Button
              onClick={() => generate.mutate()}
              disabled={generate.isPending}
              className="gap-2"
            >
              <Sparkles className="size-4" />
              {generate.isPending ? "Generando…" : "Generar con IA"}
            </Button>
            {(draft ?? p.description) && (
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => {
                  navigator.clipboard.writeText(draft ?? p.description ?? "");
                  toast.success("Copiado");
                }}
              >
                <Copy className="size-4" /> Copiar
              </Button>
            )}
          </div>
          <Textarea
            rows={10}
            value={draft ?? p.description ?? ""}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Generá una descripción con IA o escribila acá…"
          />
          <div className="flex justify-end">
            <Button
              variant="secondary"
              disabled={update.isPending || draft == null}
              onClick={async () => {
                await update.mutateAsync({ description: draft });
                toast.success("Descripción guardada");
              }}
            >
              Guardar descripción
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="grants" className="mt-4 space-y-2">
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
      </Tabs>

      <PropertyFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        property={p}
        pending={update.isPending}
        onSubmit={async (input) => {
          await update.mutateAsync(input);
          toast.success("Propiedad actualizada");
        }}
      />
    </div>
  );
}
