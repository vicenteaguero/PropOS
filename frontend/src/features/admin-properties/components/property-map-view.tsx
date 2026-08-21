import { Suspense, lazy, useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatClp } from "@shared/utils/currency";
import type { Property } from "../api/properties-api";

// The only reference to the map module anywhere in the app, and it is dynamic:
// maplibre-gl is ~200KB gzip and must stay out of the initial bundle. Anyone
// adding a static import of `./property-map` undoes that silently.
const PropertyMap = lazy(() => import("./property-map"));

const rowAnchor = (id: string) => `map-row-${id}`;

function MapRow({
  property,
  active,
  rowId,
  onHover,
  onOpen,
}: {
  property: Property;
  active: boolean;
  /** Anchor the map uses to scroll this row into view when its pin is clicked. */
  rowId: string;
  onHover: (id: string | null) => void;
  onOpen: () => void;
}) {
  return (
    <button
      id={rowId}
      type="button"
      onClick={onOpen}
      onMouseEnter={() => onHover(property.id)}
      onMouseLeave={() => onHover(null)}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border p-2 text-left transition active:scale-[0.99]",
        active ? "border-foreground bg-secondary/50" : "border-border",
      )}
    >
      {property.cover_url ? (
        <img
          src={property.cover_thumb_url ?? property.cover_url}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-14 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-secondary">
          <MapPin className="size-[18px] text-muted-foreground" strokeWidth={1.8} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-foreground">
          {property.title}
        </span>
        <span className="block truncate text-[13px] text-muted-foreground">
          {property.address ?? "Sin dirección"}
        </span>
        <span className="mt-0.5 block text-[13px] font-semibold text-foreground">
          {formatClp(property.list_price_cents, "Precio a convenir")}
        </span>
      </span>
    </button>
  );
}

/**
 * Map-first property search: the map is the query and the list follows it.
 *
 * Replaces a Google `<iframe>` built from one address string, which could only
 * ever show a single property and left the list as the real interface.
 */
export function PropertyMapView({ properties }: { properties: Property[] }) {
  const navigate = useNavigate();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // null until the map reports its first viewport — before that, showing an
  // empty list would read as "no results" rather than "not measured yet".
  const [visibleIds, setVisibleIds] = useState<string[] | null>(null);

  const geocoded = useMemo(
    () => properties.filter((p) => p.lat != null && p.lng != null),
    [properties],
  );
  const missing = properties.length - geocoded.length;

  const inView = useMemo(() => {
    if (visibleIds === null) return geocoded;
    const set = new Set(visibleIds);
    return geocoded.filter((p) => set.has(p.id));
  }, [geocoded, visibleIds]);

  const handleVisibleChange = useCallback((ids: string[]) => setVisibleIds(ids), []);
  // Clicking a pin has to move the list too, or on mobile — where the list sits
  // below the map — the selection is invisible.
  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    requestAnimationFrame(() => {
      document
        .getElementById(rowAnchor(id))
        ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }, []);

  if (geocoded.length === 0) {
    return (
      <p className="px-[var(--page-x)] py-10 text-center text-sm text-muted-foreground">
        Ninguna propiedad tiene coordenadas para mostrar en el mapa.
      </p>
    );
  }

  const list = (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between px-0.5 text-[12px] text-muted-foreground">
        <span>
          {inView.length} {inView.length === 1 ? "propiedad" : "propiedades"} en esta zona
        </span>
        {missing > 0 && <span>{missing} sin ubicar</span>}
      </div>
      {inView.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-[13px] text-muted-foreground">
          Mueve o aleja el mapa para ver propiedades.
        </p>
      ) : (
        inView.map((p) => (
          <MapRow
            key={p.id}
            rowId={rowAnchor(p.id)}
            property={p}
            active={p.id === hoveredId || p.id === selectedId}
            onHover={setHoveredId}
            onOpen={() => navigate(`/admin/properties/${p.id}`)}
          />
        ))
      )}
    </div>
  );

  const mapClass = "h-[55dvh] w-full overflow-hidden rounded-xl lg:h-[calc(100dvh-12rem)]";

  return (
    // One list, positioned by grid order rather than rendered twice: the old
    // page mounted a second copy for mobile, which duplicated every row and
    // doubled the thumbnails the browser had to fetch.
    <div className="grid grid-cols-1 gap-4 px-[var(--page-x)] lg:grid-cols-[minmax(0,22rem)_1fr] lg:gap-6">
      <div className="order-2 lg:order-none lg:col-start-1 lg:row-start-1 lg:max-h-[calc(100dvh-12rem)] lg:overflow-y-auto">
        {list}
      </div>

      <div className="order-1 min-w-0 lg:order-none lg:col-start-2 lg:row-start-1 lg:sticky lg:top-6">
        <Suspense fallback={<Skeleton className={mapClass} />}>
          <PropertyMap
            properties={geocoded}
            hoveredId={hoveredId}
            selectedId={selectedId}
            onHover={setHoveredId}
            onSelect={handleSelect}
            onVisibleChange={handleVisibleChange}
            className={mapClass}
          />
        </Suspense>
      </div>
    </div>
  );
}
