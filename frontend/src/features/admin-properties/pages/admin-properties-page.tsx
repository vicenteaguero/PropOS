import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bath, BedDouble, MapPin, Maximize, Plus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@shared/components/page-layout";
import { EmptyState } from "@shared/components/empty-state/empty-state";
import { ErrorState, ListCapNotice, PageSkeleton, PhotoCard, Pill, Segmented } from "@shared/ui";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { propertiesApi, type Property, type PropertyInput } from "../api/properties-api";
import { PropertyFormDialog } from "../components/property-form-dialog";
import { formatClp } from "@shared/utils/currency";
import { label } from "@shared/lib/labels";
import { LISTING_KIND_TONES, tone } from "@shared/lib/tones";
import { SearchInput } from "@shared/components/search-input/search-input";

/** Short stable code from the property id (presentational). */
function propertyCode(id: string): string {
  return id.replace(/-/g, "").slice(0, 6).toUpperCase();
}

function PropertyCard({ property, onClick }: { property: Property; onClick: () => void }) {
  const op = {
    label: label("listingKind", property.listing_kind),
    tone: tone(LISTING_KIND_TONES, property.listing_kind),
  };
  const specs: { icon: LucideIcon; value: string }[] = [
    ...(property.bedrooms != null ? [{ icon: BedDouble, value: `${property.bedrooms}` }] : []),
    ...(property.bathrooms != null ? [{ icon: Bath, value: `${property.bathrooms}` }] : []),
    ...(property.area_sqm != null ? [{ icon: Maximize, value: `${property.area_sqm} m²` }] : []),
  ];

  return (
    <PhotoCard
      onClick={onClick}
      overlay={
        <>
          <div className="absolute left-3 top-3 flex items-center gap-2">
            <Pill tone={op.tone}>{op.label}</Pill>
            {property.is_draft && <Pill tone="neutral">Borrador</Pill>}
          </div>
          <span className="absolute right-3 top-3 rounded-full bg-background/80 px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground backdrop-blur">
            {propertyCode(property.id)}
          </span>
        </>
      }
    >
      <div className="px-4 py-3">
        <div className="truncate text-base font-semibold leading-tight text-foreground">
          {property.title}
        </div>
        {property.address && (
          <div className="mt-0.5 truncate text-[13px] text-muted-foreground">
            {property.address}
          </div>
        )}
        <div className="mt-2 text-[17px] font-bold tracking-tight text-foreground">
          {formatClp(property.list_price_cents, "Precio a convenir")}
        </div>
        {specs.length > 0 && (
          <div className="mt-2 flex items-center gap-4 text-[13px] text-muted-foreground">
            {specs.map((s, i) => {
              const Icon = s.icon;
              return (
                <span key={i} className="inline-flex items-center gap-1.5">
                  <Icon className="size-4" strokeWidth={1.8} />
                  {s.value}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </PhotoCard>
  );
}

export function AdminPropertiesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [view, setView] = useState<"lista" | "mapa">("lista");
  const [selId, setSelId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  // Debounced so typing doesn't fire a request per keystroke; the query key
  // carries the term, so results are cached per search rather than refetched.
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "properties", debounced],
    queryFn: () => propertiesApi.list({ q: debounced }),
    placeholderData: (prev) => prev,
  });
  const create = useMutation({
    mutationFn: (body: PropertyInput) => propertiesApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "properties"] }),
    onError: (err) => toast.error(err instanceof Error ? err.message : "No se pudo crear"),
  });

  const properties = data ?? [];

  return (
    <PageLayout width="md" noPadding className="pb-6 lg:max-w-none">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 lg:px-8 lg:pt-7">
        <div>
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-foreground">
            Propiedades
          </h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {data ? `${properties.length} publicadas` : "Cartera del negocio"}
          </p>
        </div>
        <Button
          variant="ink"
          size="icon-lg"
          className="rounded-full"
          aria-label="Crear propiedad"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="size-5" strokeWidth={1.8} />
        </Button>
      </div>

      {/* Search hits the server, so it reaches the whole portfolio rather than
          filtering the 100 rows the list endpoint already returned. */}
      <div className="px-5 pb-3 lg:px-8">
        <SearchInput
          value={search}
          onChange={setSearch}
          // Capped: a search field spanning 1770px on a 2560 display reads as a
          // layout bug, not as generosity.
          className="lg:max-w-xl"
          ariaLabel="Buscar propiedades"
          placeholder="Buscar por título o dirección"
        />
      </div>

      {!isLoading && !error && properties.length > 0 && (
        <div className="mb-3 px-5 lg:px-8">
          <Segmented
            items={[
              { id: "lista", label: "Lista" },
              { id: "mapa", label: "Mapa" },
            ]}
            value={view}
            onChange={(id) => setView(id as "lista" | "mapa")}
          />
        </div>
      )}

      <PropertyFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        pending={create.isPending}
        onSubmit={async (input) => {
          await create.mutateAsync(input);
          toast.success("Propiedad creada");
        }}
      />

      {isLoading && <PageSkeleton variant="cards" />}

      {!isLoading && error && (
        <div className="px-5 lg:px-8">
          <ErrorState message="No se pudieron cargar las propiedades." onRetry={() => refetch()} />
        </div>
      )}

      {!isLoading && !error && properties.length === 0 && (
        <div className="px-5 pt-2 lg:px-8">
          {/* "Crea tu primera propiedad" is wrong when the portfolio is full and
              the search simply matched nothing — say which case this is. */}
          {debounced.trim() ? (
            <EmptyState
              title="Sin resultados"
              description={`Ninguna propiedad coincide con "${debounced.trim()}".`}
              actionLabel="Limpiar búsqueda"
              onAction={() => setSearch("")}
            />
          ) : (
            <EmptyState
              title="No hay propiedades"
              description="Crea tu primera propiedad para esta empresa."
              actionLabel="Crear propiedad"
              onAction={() => setDialogOpen(true)}
            />
          )}
        </div>
      )}

      <ListCapNotice resource="properties" count={properties.length} className="lg:mx-8" />
      {!isLoading && !error && properties.length > 0 && view === "lista" && (
        <div className="grid grid-cols-1 gap-3 px-5 lg:grid-cols-2 lg:gap-4 lg:px-8 xl:grid-cols-3 2xl:grid-cols-4">
          {properties.map((p) => (
            <PropertyCard
              key={p.id}
              property={p}
              onClick={() => navigate(`/admin/properties/${p.id}`)}
            />
          ))}
        </div>
      )}

      {!isLoading &&
        !error &&
        properties.length > 0 &&
        view === "mapa" &&
        (() => {
          const withAddr = properties.filter((p) => p.address);
          const sel = withAddr.find((p) => p.id === selId) ?? withAddr[0];
          if (!sel) {
            return (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground lg:px-8">
                Ninguna propiedad tiene dirección para mostrar en el mapa.
              </p>
            );
          }
          const propertyList = (
            <div className="space-y-2">
              {withAddr.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelId(p.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition active:scale-[0.99]",
                    p.id === sel.id ? "border-foreground" : "border-border",
                  )}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary">
                    <MapPin className="size-[18px] text-foreground" strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-foreground">{p.title}</span>
                    <span className="block truncate text-[13px] text-muted-foreground">
                      {p.address}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          );
          return (
            <div className="px-5 lg:grid lg:grid-cols-[1fr_2fr] lg:items-start lg:gap-6 lg:px-8">
              {/* Desktop: property list on the left. Mobile: map first (below). */}
              <div className="hidden lg:block">{propertyList}</div>

              <div className="min-w-0 lg:sticky lg:top-6">
                <iframe
                  title="Mapa"
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(sel.address ?? "")}&z=14&output=embed`}
                  className="h-64 w-full rounded-2xl border border-border lg:h-[calc(100dvh-12rem)]"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
                <button
                  type="button"
                  onClick={() => navigate(`/admin/properties/${sel.id}`)}
                  className="mt-3 flex w-full items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-left transition active:scale-[0.99]"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-foreground">
                      {sel.title}
                    </span>
                    <span className="block truncate text-[13px] text-muted-foreground">
                      {sel.address}
                    </span>
                  </span>
                  <span className="shrink-0 text-[13px] font-semibold text-primary">
                    Abrir ficha
                  </span>
                </button>
              </div>

              {/* Mobile: property list below the map (desktop hides this copy). */}
              <div className="mt-4 lg:hidden">{propertyList}</div>
            </div>
          );
        })()}
    </PageLayout>
  );
}
