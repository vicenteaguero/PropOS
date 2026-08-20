import { Suspense, lazy } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { Property } from "../api/properties-api";

// Same lazy boundary as the list map, for the same reason: maplibre-gl must not
// reach the initial bundle. Both entry points resolve to one shared chunk.
const PropertyMap = lazy(() => import("./property-map"));

const noop = () => {};

/**
 * One property on a real map, replacing a Google `<iframe>` that geocoded an
 * address string server-side even though `lat`/`lng` were already on the row.
 * Renders nothing when the property has no coordinates — the Waze/Maps links
 * beside it still work from the address alone.
 */
export function PropertyLocationMap({
  property,
  className,
}: {
  property: Property;
  className?: string;
}) {
  if (property.lat == null || property.lng == null) return null;

  return (
    <Suspense fallback={<Skeleton className={className} />}>
      <PropertyMap
        properties={[property]}
        hoveredId={null}
        selectedId={property.id}
        onHover={noop}
        onSelect={noop}
        onVisibleChange={noop}
        className={className}
      />
    </Suspense>
  );
}
