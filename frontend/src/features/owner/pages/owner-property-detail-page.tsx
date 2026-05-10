import { useMemo } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft, Calendar, Download, Eye, FileText, Lock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { LoadingSpinner } from "@shared/components/loading-spinner/loading-spinner";
import { apiRequest } from "@features/documents/api/http";
import { useGrantForProperty } from "@features/owner/hooks/use-my-grants";

interface ApiDocument {
  id: string;
  display_name: string;
  kind: string;
  created_at: string;
  audience_caps?: Record<string, string[]>;
}

interface ApiInteraction {
  id: string;
  kind: string;
  occurred_at: string;
  duration_minutes: number | null;
  summary: string | null;
  audience_caps?: Record<string, string[]>;
}

function audienceHas(
  caps: Record<string, string[]> | undefined,
  view: string,
  cap: string,
): boolean {
  return !!caps?.[view]?.includes(cap);
}

export function OwnerPropertyDetailPage() {
  const { id: propertyId } = useParams<{ id: string }>();
  const { grant, isLoading: grantLoading } = useGrantForProperty(propertyId);

  const docsQ = useQuery({
    queryKey: ["owner", "docs", propertyId],
    queryFn: () =>
      apiRequest<ApiDocument[]>(`/v1/documents?property_id=${propertyId}`).catch(
        () => [] as ApiDocument[],
      ),
    enabled: !!propertyId && !!grant,
  });

  const visitsQ = useQuery({
    queryKey: ["owner", "visits", propertyId],
    queryFn: () =>
      apiRequest<ApiInteraction[]>(`/v1/interactions?property_id=${propertyId}&kind=VISIT`).catch(
        () => [] as ApiInteraction[],
      ),
    enabled: !!propertyId && !!grant,
  });

  const canDownload = useMemo(
    () => grant?.capabilities.includes("download_documents") ?? false,
    [grant],
  );
  const canSeeVisitors = useMemo(
    () => grant?.capabilities.includes("view_visitor_identity") ?? false,
    [grant],
  );

  if (grantLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-16">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  if (!grant) {
    return <Navigate to="/owner" replace />;
  }

  return (
    <TooltipProvider>
      <div className="mx-auto w-full max-w-3xl p-4 sm:p-6">
        <Link
          to="/owner"
          className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Volver
        </Link>

        <header className="mb-6">
          <h1 className="text-2xl font-bold">{grant.propertyTitle ?? "Propiedad"}</h1>
          {grant.propertyAddress && (
            <p className="text-sm text-muted-foreground">{grant.propertyAddress}</p>
          )}
        </header>

        <Tabs defaultValue="documents" className="w-full">
          <TabsList>
            <TabsTrigger value="documents">Documentos</TabsTrigger>
            <TabsTrigger value="visits">Visitas</TabsTrigger>
            <TabsTrigger value="detail">Detalle</TabsTrigger>
          </TabsList>

          <TabsContent value="documents" className="mt-4 space-y-3">
            {docsQ.isLoading && (
              <div className="flex justify-center py-8">
                <LoadingSpinner size="sm" />
              </div>
            )}
            {!docsQ.isLoading && (docsQ.data ?? []).length === 0 && (
              <Card>
                <CardContent className="py-6 text-center text-sm text-muted-foreground">
                  No hay documentos compartidos contigo todavía.
                </CardContent>
              </Card>
            )}
            {(docsQ.data ?? []).map((doc) => {
              const docCanDownload =
                canDownload && audienceHas(doc.audience_caps, "owner", "download");
              return (
                <div
                  key={doc.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <FileText className="size-5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{doc.display_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {doc.kind} · {new Date(doc.created_at).toLocaleDateString("es-CL")}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-accent"
                    >
                      <Eye className="size-3.5" /> Ver
                    </button>
                    {docCanDownload ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-accent"
                      >
                        <Download className="size-3.5" /> Descargar
                      </button>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex cursor-not-allowed items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground opacity-60">
                            <Lock className="size-3.5" /> Descargar
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>El admin no habilitó descarga.</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>
              );
            })}
          </TabsContent>

          <TabsContent value="visits" className="mt-4 space-y-3">
            {visitsQ.isLoading && (
              <div className="flex justify-center py-8">
                <LoadingSpinner size="sm" />
              </div>
            )}
            {!visitsQ.isLoading && (visitsQ.data ?? []).length === 0 && (
              <Card>
                <CardContent className="py-6 text-center text-sm text-muted-foreground">
                  Sin visitas compartidas todavía.
                </CardContent>
              </Card>
            )}
            {(visitsQ.data ?? []).map((v) => {
              const showVisitor =
                canSeeVisitors && audienceHas(v.audience_caps, "owner", "view_visitor_identity");
              return (
                <div key={v.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="mb-1 flex items-center gap-2 text-sm font-medium">
                    <Calendar className="size-4 text-muted-foreground" />
                    {new Date(v.occurred_at).toLocaleString("es-CL")}
                    {v.duration_minutes != null && (
                      <span className="text-xs text-muted-foreground">
                        · {v.duration_minutes} min
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {showVisitor ? (v.summary ?? "(sin notas)") : "Visitante (anónimo)"}
                  </div>
                </div>
              );
            })}
          </TabsContent>

          <TabsContent value="detail" className="mt-4">
            <Card>
              <CardContent className="py-4 text-sm">
                <div className="mb-2">
                  <span className="text-muted-foreground">Dirección: </span>
                  {grant.propertyAddress ?? "—"}
                </div>
                <div className="text-muted-foreground">
                  Tu acceso incluye:{" "}
                  {grant.capabilities.length ? grant.capabilities.join(", ") : "—"}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}
