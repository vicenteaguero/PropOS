import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Bath,
  BedDouble,
  CalendarClock,
  Copy,
  Maximize,
  Pencil,
  Sparkles,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ErrorState,
  NavMark,
  PageSkeleton,
  Pill,
  Row,
  SectionLabel,
  type PillTone,
} from "@shared/ui";
import { PageLayout } from "@shared/components/page-layout";
import { apiRequest } from "@shared/api/http";
import { toast } from "sonner";
import { propertiesApi, type PropertyInput } from "../api/properties-api";
import { PropertyFormDialog } from "../components/property-form-dialog";
import { PropertyGallery } from "../components/property-gallery";

interface ApiGrant {
  id: string;
  user_id: string;
  view: string;
  capabilities: string[];
}

/** Operation label + tone: Venta → success, Arriendo → warning. */
function listingMeta(kind: string): { label: string; tone: PillTone } {
  switch (kind) {
    case "SALE":
      return { label: "Venta", tone: "success" };
    case "RENT":
      return { label: "Arriendo", tone: "warning" };
    case "LEASE":
      return { label: "Leasing", tone: "accent" };
    default:
      return { label: kind, tone: "neutral" };
  }
}

function clp(cents: number | null): string {
  if (cents == null) return "Precio a convenir";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function AdminPropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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

  if (propQ.isLoading) {
    return (
      <PageLayout width="sm" className="lg:max-w-none">
        <PageSkeleton variant="detail" />
      </PageLayout>
    );
  }

  if (propQ.error || !propQ.data) {
    return (
      <PageLayout width="sm" className="lg:max-w-none">
        <ErrorState
          error={propQ.error}
          message={
            propQ.error
              ? undefined
              : "No se encontró la propiedad. Es posible que se haya eliminado."
          }
          onRetry={() => propQ.refetch()}
        />
        <Button
          variant="outline"
          size="sm"
          className="mt-3 gap-1.5"
          onClick={() => navigate("/admin/properties")}
        >
          <ArrowLeft className="size-4" strokeWidth={1.8} /> Propiedades
        </Button>
      </PageLayout>
    );
  }

  const p = propQ.data;
  const op = listingMeta(p.listing_kind);
  const grants = grantsQ.data ?? [];

  const specs = [
    { icon: BedDouble, label: "Dormitorios", value: p.bedrooms ?? "—" },
    { icon: Bath, label: "Baños", value: p.bathrooms ?? "—" },
    { icon: Maximize, label: "Superficie", value: p.area_sqm != null ? `${p.area_sqm} m²` : "—" },
    { icon: CalendarClock, label: "Año", value: p.year_built ?? "—" },
  ];

  const wazeHref = p.address
    ? `waze://?q=${encodeURIComponent(p.address)}&navigate=yes`
    : undefined;
  const mapsHref = p.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.address)}`
    : undefined;

  return (
    <PageLayout width="sm" noPadding className="pb-10 lg:max-w-none">
      {/* Header bar */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2 lg:px-8 lg:pt-6">
        <Link
          to="/admin/properties"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="size-4" strokeWidth={1.8} /> Propiedades
        </Link>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditOpen(true)}>
          <Pencil className="size-4" strokeWidth={1.8} /> Editar
        </Button>
      </div>

      {/* Desktop: 2-column (gallery/title/specs/tabs left · location/interesados right).
          Mobile: single column in DOM order — unchanged. */}
      <div className="lg:grid lg:grid-cols-[1.6fr_1fr] lg:items-start lg:gap-8 lg:px-8">
        {/* Gallery */}
        <div className="px-5 lg:col-start-1 lg:row-start-1 lg:px-0">
          <PropertyGallery
            propertyId={p.id}
            overlay={
              <>
                <Pill tone={op.tone}>{op.label}</Pill>
                {p.is_draft && <Pill tone="neutral">Borrador</Pill>}
              </>
            }
          />
        </div>

        {/* Title + price */}
        <div className="px-5 pt-4 lg:col-start-1 lg:row-start-2 lg:px-0">
          <h1 className="text-[24px] font-bold leading-tight tracking-tight text-foreground">
            {p.title}
          </h1>
          {p.address && <p className="mt-1 text-[14px] text-muted-foreground">{p.address}</p>}
          <div className="mt-2 text-[22px] font-bold tracking-tight text-foreground">
            {clp(p.list_price_cents)}
          </div>
        </div>

        {/* Specs tile */}
        <div className="px-5 pt-4 lg:col-start-1 lg:row-start-3 lg:px-0">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-4">
            {specs.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="flex flex-col gap-1 bg-card px-4 py-3.5">
                  <Icon className="size-[18px] text-muted-foreground" strokeWidth={1.8} />
                  <span className="text-base font-semibold text-foreground">{s.value}</span>
                  <span className="text-[11px] text-muted-foreground">{s.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cómo llegar */}
        {p.address && (
          <div className="px-5 pt-5 lg:col-start-2 lg:row-span-4 lg:row-start-1 lg:px-0 lg:pt-0">
            <SectionLabel className="px-0">Cómo llegar</SectionLabel>
            <iframe
              title="Ubicación"
              src={`https://maps.google.com/maps?q=${encodeURIComponent(p.address)}&z=15&output=embed`}
              className="mt-2 h-44 w-full rounded-2xl border border-border lg:h-72"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
            <div className="mt-3 grid grid-cols-2 gap-3">
              <a
                href={wazeHref}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 transition active:scale-[0.99]"
              >
                <NavMark app="waze" size={32} />
                <span className="text-[15px] font-semibold text-foreground">Waze</span>
              </a>
              <a
                href={mapsHref}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 transition active:scale-[0.99]"
              >
                <NavMark app="maps" size={32} />
                <span className="text-[15px] font-semibold text-foreground">Maps</span>
              </a>
            </div>
          </div>
        )}

        {/* Tabs: Descripción IA + Accesos */}
        <div className="px-5 pt-6 lg:col-start-1 lg:row-start-4 lg:px-0">
          <Tabs defaultValue="descripcion" className="w-full">
            <TabsList>
              <TabsTrigger value="descripcion">Descripción IA</TabsTrigger>
              <TabsTrigger value="grants">Interesados</TabsTrigger>
            </TabsList>

            <TabsContent value="descripcion" className="mt-4 space-y-3">
              <div className="flex gap-2">
                <Button
                  onClick={() => generate.mutate()}
                  disabled={generate.isPending}
                  className="gap-2"
                >
                  <Sparkles className="size-4" strokeWidth={1.8} />
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
                    <Copy className="size-4" strokeWidth={1.8} /> Copiar
                  </Button>
                )}
              </div>
              <Textarea
                aria-label="Descripción de la propiedad"
                rows={10}
                className="rounded-2xl"
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

            <TabsContent value="grants" className="mt-4">
              {grants.length === 0 && !grantsQ.isLoading && (
                <div className="rounded-2xl border border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground">
                  Sin accesos otorgados. Usá la sección Usuarios para otorgar.
                </div>
              )}
              {grants.length > 0 && (
                <div className="overflow-hidden rounded-2xl border border-border bg-card">
                  {grants.map((g, i) => (
                    <Row
                      key={g.id}
                      onClick={() => navigate(`/admin/users/${g.user_id}`)}
                      divider={i < grants.length - 1}
                      left={
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-foreground">
                          {g.user_id.slice(0, 2).toUpperCase()}
                        </span>
                      }
                      title={`${g.user_id.slice(0, 8)}…`}
                      sub={g.view}
                      right={
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {g.capabilities.map((c) => (
                            <Pill key={c} tone="neutral">
                              {c}
                            </Pill>
                          ))}
                        </div>
                      }
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

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
    </PageLayout>
  );
}
