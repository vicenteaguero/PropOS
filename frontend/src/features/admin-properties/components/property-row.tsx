import { Bath, BedDouble, Maximize, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { abbreviateClp } from "@shared/utils/currency";
import { shortPropertyTitle } from "@shared/utils/display-name";
import { FOCUS_RING } from "@shared/ui";
import type { Property } from "../api/properties-api";

interface PropertyRowProps {
  property: Property;
  onOpen: () => void;
  onIntent?: () => void;
  /** Highlighted because its pin is hovered or selected on the map. */
  active?: boolean;
  /** Anchor the map uses to scroll this row into view. */
  rowId?: string;
  onHover?: (id: string | null) => void;
  className?: string;
}

/**
 * A property, as one row.
 *
 * It was `MapRow`, private to `property-map-view.tsx`, while the page's "Lista"
 * view rendered a grid of cards under a `LayoutGrid` icon — so the app had a
 * real list row and a view called "Lista" that was not one, and the two could
 * not be told apart from the toggle.
 *
 * Three changes came with the move: the price is abbreviated (`$185M`, not
 * "$185.000.000", which was wider than the title above it), the title is
 * shortened to the two facts a list is scanned for, and the specs — bedrooms,
 * bathrooms, area — sit on one line instead of nowhere.
 */
export function PropertyRow({
  property,
  onOpen,
  onIntent,
  active = false,
  rowId,
  onHover,
  className,
}: PropertyRowProps) {
  const specs = [
    property.bedrooms != null && { icon: BedDouble, value: `${property.bedrooms}` },
    property.bathrooms != null && { icon: Bath, value: `${property.bathrooms}` },
    property.area_sqm != null && { icon: Maximize, value: `${Math.round(property.area_sqm)} m²` },
  ].filter(Boolean) as { icon: typeof BedDouble; value: string }[];

  return (
    <button
      id={rowId}
      type="button"
      onClick={onOpen}
      onMouseEnter={() => {
        onHover?.(property.id);
        onIntent?.();
      }}
      onFocus={onIntent}
      onMouseLeave={() => onHover?.(null)}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border p-2 text-left transition active:scale-[0.99]",
        FOCUS_RING,
        active ? "border-foreground bg-secondary/50" : "border-border hover:bg-secondary/40",
        className,
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
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-foreground">
            {shortPropertyTitle(property.title)}
          </span>
          <span className="shrink-0 font-mono text-[14px] font-semibold tabular-nums text-foreground">
            {abbreviateClp(property.list_price_cents, "A convenir")}
          </span>
        </span>
        <span className="block truncate text-[12.5px] text-muted-foreground">
          {property.address ?? "Sin dirección"}
        </span>
        {specs.length > 0 && (
          <span className="mt-0.5 flex items-center gap-2.5 text-[12px] text-muted-foreground">
            {specs.map(({ icon: Icon, value }) => (
              <span key={value} className="flex items-center gap-1">
                <Icon className="size-3.5 shrink-0" strokeWidth={1.8} />
                {value}
              </span>
            ))}
          </span>
        )}
      </span>
    </button>
  );
}
