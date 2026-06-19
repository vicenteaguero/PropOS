import { useMemo } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft, Calendar, Download, Eye, FileText, Lock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@shared/components/loading-spinner/loading-spinner";
import { Pill, Row } from "@shared/ui";
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

  const docs = docsQ.data ?? [];
  const visits = visitsQ.data ?? [];

  return (
    <TooltipProvider>
      <div className="mx-auto w-full max-w-2xl pb-10">
        {/* Header bar */}
        <div className="px-5 pt-4 pb-2">
          <Link
            to="/owner"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="size-4" strokeWidth={1.8} /> Mis propiedades
          </Link>
        </div>

        {/* Gallery placeholder */}
        <div className="px-5">
          <div className="relative h-52 w-full overflow-hidden rounded-2xl bg-gradient-to-br from-secondary to-muted text-foreground">
            <div
              className="absolute inset-0 opacity-[0.04]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(45deg, currentColor 0 14px, transparent 14px 28px)",
              }}
            />
          </div>
        </div>

        {/* Title + address */}
        <div className="px-5 pt-4">
          <h1 className="text-[24px] font-bold leading-tight tracking-tight text-foreground">
            {grant.propertyTitle ?? "Propiedad"}
          </h1>
          {grant.propertyAddress && (
            <p className="mt-1 text-[14px] text-muted-foreground">{grant.propertyAddress}</p>
          )}
        </div>

        {/* Tabs: Documentos + Visitas + Detalle */}
        <div className="px-5 pt-5">
          <Tabs defaultValue="documents" className="w-full">
            <TabsList>
              <TabsTrigger value="documents">Documentos</TabsTrigger>
              <TabsTrigger value="visits">Visitas</TabsTrigger>
              <TabsTrigger value="detail">Detalle</TabsTrigger>
            </TabsList>

            <TabsContent value="documents" className="mt-4">
              {docsQ.isLoading && (
                <div className="flex justify-center py-8">
                  <LoadingSpinner size="sm" />
                </div>
              )}
              {!docsQ.isLoading && docs.length === 0 && (
                <div className="rounded-2xl border border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground">
                  No hay documentos compartidos contigo todavía.
                </div>
              )}
              {docs.length > 0 && (
                <div className="overflow-hidden rounded-2xl border border-border bg-card">
                  {docs.map((doc, i) => {
                    const docCanDownload =
                      canDownload && audienceHas(doc.audience_caps, "owner", "download");
                    return (
                      <Row
                        key={doc.id}
                        divider={i < docs.length - 1}
                        left={
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground">
                            <FileText className="size-[18px]" strokeWidth={1.8} />
                          </span>
                        }
                        title={doc.display_name}
                        sub={`${doc.kind} · ${new Date(doc.created_at).toLocaleDateString("es-CL")}`}
                        right={
                          <div className="flex shrink-0 items-center gap-1.5">
                            <Button variant="outline" size="xs" className="gap-1">
                              <Eye className="size-3.5" strokeWidth={1.8} /> Ver
                            </Button>
                            {docCanDownload ? (
                              <Button variant="outline" size="xs" className="gap-1">
                                <Download className="size-3.5" strokeWidth={1.8} /> Descargar
                              </Button>
                            ) : (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex cursor-not-allowed items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground opacity-60">
                                    <Lock className="size-3.5" strokeWidth={1.8} /> Descargar
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>El admin no habilitó descarga.</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        }
                      />
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="visits" className="mt-4 space-y-3">
              {visitsQ.isLoading && (
                <div className="flex justify-center py-8">
                  <LoadingSpinner size="sm" />
                </div>
              )}
              {!visitsQ.isLoading && visits.length === 0 && (
                <div className="rounded-2xl border border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground">
                  Sin visitas compartidas todavía.
                </div>
              )}
              {visits.map((v) => {
                const showVisitor =
                  canSeeVisitors && audienceHas(v.audience_caps, "owner", "view_visitor_identity");
                return (
                  <div key={v.id} className="rounded-2xl border border-border bg-card p-4">
                    <div className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
                      <Calendar className="size-4 text-muted-foreground" strokeWidth={1.8} />
                      {new Date(v.occurred_at).toLocaleString("es-CL")}
                      {v.duration_minutes != null && (
                        <Pill tone="neutral">{v.duration_minutes} min</Pill>
                      )}
                    </div>
                    <div className="mt-1.5 text-[13px] text-muted-foreground">
                      {showVisitor ? (v.summary ?? "(sin notas)") : "Visitante (anónimo)"}
                    </div>
                  </div>
                );
              })}
            </TabsContent>

            <TabsContent value="detail" className="mt-4 space-y-3">
              <div className="rounded-2xl border border-border bg-card px-5 py-4">
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Dirección
                </div>
                <div className="mt-1 text-[15px] text-foreground">
                  {grant.propertyAddress ?? "—"}
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card px-5 py-4">
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Tu acceso incluye
                </div>
                {grant.capabilities.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {grant.capabilities.map((c) => (
                      <Pill key={c} tone="neutral">
                        {c}
                      </Pill>
                    ))}
                  </div>
                ) : (
                  <div className="mt-1 text-[15px] text-muted-foreground">—</div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </TooltipProvider>
  );
}
