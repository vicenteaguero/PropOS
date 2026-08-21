import { Link } from "react-router-dom";
import { Building2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Pill, SectionLabel } from "@shared/ui";
import { formatClp } from "@shared/utils/currency";
import { label } from "@shared/lib/labels";
import { propertiesApi } from "../api/properties-api";

/** Building attributes worth naming, in the order a broker would say them. */
const SHARED_LABELS: Record<string, string> = {
  gastos_comunes: "Gastos comunes",
  amenities: "Amenidades",
  bodegas: "Bodegas",
  estacionamientos: "Estacionamientos",
  conserjeria: "Conserjería",
};

function sharedValue(key: string, value: unknown): string {
  if (Array.isArray(value)) return value.join(" · ");
  if (typeof value === "number" && key === "gastos_comunes") return formatClp(value * 100);
  return String(value);
}

/**
 * The other units in this building.
 *
 * `properties.address` is free text, so forty flats in one tower were forty
 * spellings of one street — nothing could group them, and "¿qué más tienen
 * acá?", the first question a buyer asks, had no answer on the page. Renders
 * nothing for a standalone house, which is most of the inventory.
 */
export function BuildingUnits({ propertyId, role }: { propertyId: string; role: string }) {
  const { data: building } = useQuery({
    queryKey: ["property", propertyId, "building"],
    queryFn: () => propertiesApi.building(propertyId),
  });

  if (!building) return null;

  const shared = Object.entries(building.shared ?? {}).filter(([, v]) => v !== null && v !== "");

  return (
    <div>
      <SectionLabel>Edificio</SectionLabel>
      <div className="mt-2 overflow-hidden rounded-xl border border-border">
        <div className="flex items-start gap-3 border-b border-border bg-card px-4 py-3">
          <Building2
            className="mt-0.5 size-[18px] shrink-0 text-muted-foreground"
            strokeWidth={1.8}
          />
          <div className="min-w-0">
            <p className="truncate text-[14px] font-medium text-foreground">{building.name}</p>
            {(building.comuna || building.year_built) && (
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                {[building.comuna, building.year_built && `${building.year_built}`]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
            {shared.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {shared.map(([k, v]) => (
                  <Pill key={k} tone="neutral">
                    {SHARED_LABELS[k] ?? k}: {sharedValue(k, v)}
                  </Pill>
                ))}
              </div>
            )}
          </div>
        </div>

        {building.units.length === 0 ? (
          <p className="bg-card px-4 py-3 text-[13px] text-muted-foreground">
            Es la única unidad registrada en este edificio.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {building.units.map((u) => (
              <li key={u.id}>
                <Link
                  to={`/${role}/propiedades/${u.id}`}
                  className="flex items-center gap-3 bg-card px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                >
                  {u.unit_label && (
                    <span className="w-12 shrink-0 text-[13px] font-semibold tabular-nums text-foreground">
                      {u.unit_label}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
                    {u.title}
                  </span>
                  {u.area_sqm != null && (
                    <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">
                      {u.area_sqm} m²
                    </span>
                  )}
                  <span className="shrink-0 text-[13px] font-medium tabular-nums text-foreground">
                    {formatClp(u.list_price_cents, "—")}
                  </span>
                  <Pill tone={u.status === "AVAILABLE" ? "success" : "neutral"}>
                    {label("propertyStatus", u.status)}
                  </Pill>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
