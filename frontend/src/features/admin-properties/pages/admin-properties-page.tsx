import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useOpenOnParam } from "@shared/hooks/use-open-on-param";
import { useIntentPrefetch } from "@shared/hooks/use-intent-prefetch";
import { propertyQueries } from "../hooks/use-property-detail";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@shared/hooks/use-auth";
import { Bath, BedDouble, Maximize, LayoutGrid, List, Map as MapIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@shared/components/page-layout";
import { EmptyState } from "@shared/components/empty-state/empty-state";
import {
  ActionIcon,
  CONTROL_SQUARE,
  ListShell,
  LoadMore,
  PhotoCard,
  Pill,
  ViewToggle,
} from "@shared/ui";
import { toast } from "sonner";
import { propertiesApi, type Property, type PropertyInput } from "../api/properties-api";
import { PropertyRow } from "../components/property-row";
import { PropertyFormDialog } from "../components/property-form-dialog";
import { PropertyMapView } from "../components/property-map-view";
import { formatClp } from "@shared/utils/currency";
import { label } from "@shared/lib/labels";
import { LISTING_KIND_TONES, tone } from "@shared/lib/tones";

function PropertyCard({
  property,
  onClick,
  onIntent,
}: {
  property: Property;
  onClick: () => void;
  /** Hover/focus, before the click — the moment to fetch the detail. */
  onIntent?: () => void;
}) {
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
      onIntent={onIntent}
      // `cover_url` is the ~800px WebP derivative signed by the list endpoint —
      // the grid never touches the full-resolution original.
      src={property.cover_url}
      srcThumb={property.cover_thumb_url}
      alt={property.title}
      overlay={
        <>
          <div className="absolute left-3 top-3 flex items-center gap-2">
            <Pill tone={op.tone}>{op.label}</Pill>
            {property.is_draft && <Pill tone="neutral">Borrador</Pill>}
          </div>
          {/* Nothing on the right. It used to carry the first six hex digits
              of the row's uuid — "5F393E" — as the loudest badge on the card,
              for a code the broker cannot quote, cannot search for and never
              sees anywhere else in the product. */}
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
          <div className="mt-2 flex items-center gap-3 whitespace-nowrap text-[13px] text-muted-foreground">
            {specs.map((s, i) => {
              const Icon = s.icon;
              return (
                <span key={i} className="inline-flex shrink-0 items-center gap-1.5">
                  <Icon className="size-4 shrink-0" strokeWidth={1.8} />
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

/** Rows per request: two or three grid rows, so a page fills a screen. */
const PROPERTIES_PAGE_SIZE = 60;

export function AdminPropertiesPage() {
  const navigate = useNavigate();
  // Never hardcode /admin: an AGENT tapping a card was thrown out of their own
  // role root and into a tree they cannot open.
  const { user } = useAuth();
  const role = (user?.role ?? "ADMIN").toLowerCase();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  useOpenOnParam("nuevo", () => setDialogOpen(true));
  const prefetch = useIntentPrefetch();
  const [view, setView] = useState<"lista" | "grilla" | "mapa">("lista");
  const [search, setSearch] = useState("");
  // Debounced so typing doesn't fire a request per keystroke; the query key
  // carries the term, so results are cached per search rather than refetched.
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);
  // Paged rather than a single capped slab: the endpoint stopped at 100 rows
  // and said nothing, so a tenant past that simply could not reach the rest.
  const {
    data: pages,
    isLoading,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["admin", "properties", debounced],
    queryFn: ({ pageParam }) =>
      propertiesApi.list({ q: debounced, limit: PROPERTIES_PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    // A short page is the end of the list. The endpoint returns rows, not a
    // total, and asking for a count per page would cost more than the page.
    getNextPageParam: (last, all) =>
      last.length < PROPERTIES_PAGE_SIZE ? undefined : all.length * PROPERTIES_PAGE_SIZE,
    placeholderData: (prev) => prev,
  });
  const data = useMemo(() => pages?.pages.flat(), [pages]);
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
        // The section tab already reads "Propiedades"; see ListShell.titleSr.
        titleSr="Propiedades"
        // Search hits the server, so it reaches the whole portfolio rather than
        // filtering the 100 rows the list endpoint already returned.
        search={{
          value: search,
          onChange: setSearch,
          placeholder: "Buscar propiedad…",
          ariaLabel: "Buscar propiedades",
        }}
        primaryAction={
          <Button
            variant="ink"
            size="icon-lg"
            className={cn("rounded-full", CONTROL_SQUARE)}
            aria-label="Crear propiedad"
            onClick={() => setDialogOpen(true)}
          >
            <ActionIcon name="createProperty" size="lg" />
          </Button>
        }
        filtersInline
        filters={
          properties.length > 0 && !isLoading && !error ? (
            // Same properties, another way of looking at them — a setting, not
            // a destination. As a tab bar it was a third row of tabs stacked
            // under the section tabs and the page title.
            <ViewToggle
              value={view}
              onChange={setView}
              options={[
                // `List`, not `LayoutGrid`: the icon was a grid because the
                // view WAS a grid, under a label that said "Lista". Now there
                // are three, and each icon draws what it opens.
                { value: "lista", label: "Lista", icon: <List className="size-4" /> },
                { value: "grilla", label: "Fotos", icon: <LayoutGrid className="size-4" /> },
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
      >
        {view === "lista" ? (
          // A real list: one row per property, the two facts you scan for on
          // the first line and the specs on the second.
          <div className="space-y-2 px-[var(--page-x)]">
            {properties.map((p) => (
              <PropertyRow
                key={p.id}
                property={p}
                onOpen={() => navigate(`/${role}/propiedades/${p.id}`)}
                onIntent={() => prefetch(propertyQueries.detail(p.id))}
              />
            ))}
            {hasNextPage && <LoadMore onVisible={fetchNextPage} busy={isFetchingNextPage} />}
          </div>
        ) : view === "grilla" ? (
          // Two columns from 360px up. One card per screen meant scrolling
          // through 40 properties one at a time; the point of the list is to
          // FIND one, and a cover plus a price is legible at half width.
          <div className="grid grid-cols-2 gap-2 px-[var(--page-x)] min-[900px]:grid-cols-3 lg:gap-4 xl:grid-cols-4 2xl:grid-cols-5">
            {properties.map((p) => (
              <PropertyCard
                key={p.id}
                property={p}
                onClick={() => navigate(`/${role}/propiedades/${p.id}`)}
                onIntent={() => prefetch(propertyQueries.detail(p.id))}
              />
            ))}
            {hasNextPage && (
              <div className="col-span-full">
                <LoadMore onVisible={fetchNextPage} busy={isFetchingNextPage} />
              </div>
            )}
          </div>
        ) : (
          <PropertyMapView properties={properties} />
        )}
      </ListShell>
    </PageLayout>
  );
}
