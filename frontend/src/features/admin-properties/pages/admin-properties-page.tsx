import { useEffect, useState } from "react";
import { useOpenOnParam } from "@shared/hooks/use-open-on-param";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@shared/hooks/use-auth";
import { Bath, BedDouble, Maximize, Plus, LayoutGrid, Map as MapIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@shared/components/page-layout";
import { EmptyState } from "@shared/components/empty-state/empty-state";
import { ListCapNotice, ListShell, PhotoCard, Pill, ViewToggle } from "@shared/ui";
import { toast } from "sonner";
import { propertiesApi, type Property, type PropertyInput } from "../api/properties-api";
import { PropertyFormDialog } from "../components/property-form-dialog";
import { PropertyMapView } from "../components/property-map-view";
import { formatClp } from "@shared/utils/currency";
import { label } from "@shared/lib/labels";
import { LISTING_KIND_TONES, tone } from "@shared/lib/tones";

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
      // `cover_url` is the ~800px WebP derivative signed by the list endpoint —
      // the grid never touches the full-resolution original.
      src={property.cover_url}
      alt={property.title}
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
      <div className="px-3 py-2.5">
        <div className="line-clamp-2 text-[13.5px] font-semibold leading-tight text-foreground">
          {property.title}
        </div>
        {property.address && (
          <div className="mt-0.5 truncate text-[12px] text-muted-foreground">
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
  // Never hardcode /admin: an AGENT tapping a card was thrown out of their own
  // role root and into a tree they cannot open.
  const { user } = useAuth();
  const role = (user?.role ?? "ADMIN").toLowerCase();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  useOpenOnParam("nuevo", () => setDialogOpen(true));
  const [view, setView] = useState<"lista" | "mapa">("lista");
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
  const searching = debounced.trim().length > 0;

  return (
    <PageLayout width="md" noPadding className="pb-6 lg:max-w-none">
      <PropertyFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        pending={create.isPending}
        onSubmit={async (input) => {
          await create.mutateAsync(input);
          toast.success("Propiedad creada");
        }}
      />

      <ListShell
        title="Propiedades"
        // Search hits the server, so it reaches the whole portfolio rather than
        // filtering the 100 rows the list endpoint already returned.
        search={{
          value: search,
          onChange: setSearch,
          placeholder: "Buscar por título o dirección",
          ariaLabel: "Buscar propiedades",
        }}
        action={
          <Button
            variant="ink"
            size="icon-lg"
            className="rounded-full"
            aria-label="Crear propiedad"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="size-5" strokeWidth={1.8} />
          </Button>
        }
        filters={
          properties.length > 0 && !isLoading && !error ? (
            // Same properties, another way of looking at them — a setting, not
            // a destination. As a tab bar it was a third row of tabs stacked
            // under the section tabs and the page title.
            <ViewToggle
              value={view}
              onChange={setView}
              options={[
                { value: "lista", label: "Lista", icon: <LayoutGrid className="size-4" /> },
                { value: "mapa", label: "Mapa", icon: <MapIcon className="size-4" /> },
              ]}
            />
          ) : undefined
        }
        isLoading={isLoading}
        error={error}
        onRetry={() => refetch()}
        errorMessage="No se pudieron cargar las propiedades."
        skeleton="cards"
        isEmpty={properties.length === 0}
        empty={
          // "Crea tu primera propiedad" is wrong when the portfolio is full and
          // the search simply matched nothing — say which case this is.
          searching ? (
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
          )
        }
        footer={
          <ListCapNotice
            resource="properties"
            count={properties.length}
            className="mx-[var(--page-x)]"
          />
        }
      >
        {view === "lista" ? (
          // Two columns from 360px up. One card per screen meant scrolling
          // through 40 properties one at a time; the point of the list is to
          // FIND one, and a cover plus a price is legible at half width.
          <div className="grid grid-cols-2 gap-2 px-[var(--page-x)] min-[900px]:grid-cols-3 lg:gap-4 xl:grid-cols-4 2xl:grid-cols-5">
            {properties.map((p) => (
              <PropertyCard
                key={p.id}
                property={p}
                onClick={() => navigate(`/${role}/propiedades/${p.id}`)}
              />
            ))}
          </div>
        ) : (
          <PropertyMapView properties={properties} />
        )}
      </ListShell>
    </PageLayout>
  );
}
