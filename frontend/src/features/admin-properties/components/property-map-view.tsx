import { Suspense, lazy, useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { PropertyRow } from "./property-row";
import type { Property } from "../api/properties-api";

// The only reference to the map module anywhere in the app, and it is dynamic:
// maplibre-gl is ~200KB gzip and must stay out of the initial bundle. Anyone
// adding a static import of `./property-map` undoes that silently.
const PropertyMap = lazy(() => import("./property-map"));

const rowAnchor = (id: string) => `map-row-${id}`;

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
          <PropertyRow
            key={p.id}
            rowId={rowAnchor(p.id)}
            property={p}
            active={p.id === hoveredId || p.id === selectedId}
            onHover={setHoveredId}
            onOpen={() => navigate(`/admin/propiedades/${p.id}`)}
          />
        ))
      )}
    </div>
  );

  // 40dvh on a phone, not 55: at 55 the map plus the page header filled the
  // fold, so the list it exists to filter began below it and the two were
  // never on screen together — which is the entire point of a map view.
  const mapClass = "h-[40dvh] w-full overflow-hidden rounded-xl lg:h-[calc(100dvh-12rem)]";

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
