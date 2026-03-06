import { Link } from "react-router-dom";
import type { Property, PropertyStatus } from "@features/properties/types";

interface PropertyCardProps {
  property: Property;
  basePath: string;
}

const STATUS_LABELS: Record<PropertyStatus, string> = {
  AVAILABLE: "Disponible",
  RESERVED: "Reservada",
  SOLD: "Vendida",
  INACTIVE: "Inactiva",
};

const STATUS_COLORS: Record<PropertyStatus, string> = {
  AVAILABLE: "bg-green-900/30 text-green-400",
  RESERVED: "bg-yellow-900/30 text-yellow-400",
  SOLD: "bg-blue-900/30 text-blue-400",
  INACTIVE: "bg-gray-900/30 text-gray-400",
};

const SURFACE_UNIT = "m\u00B2";

export function PropertyCard({ property, basePath }: PropertyCardProps) {
  const statusLabel = STATUS_LABELS[property.status];
  const statusColor = STATUS_COLORS[property.status];

  return (
    <Link
      to={`${basePath}/${property.id}`}
      className="block rounded-lg border border-gris-acero/20 bg-negro-carbon p-4 transition-colors duration-150 hover:border-rosa-antiguo/40"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-blanco-nieve">{property.title}</h3>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusColor}`}>
          {statusLabel}
        </span>
      </div>

      {property.address && (
        <p className="mb-1 text-xs text-gris-acero">{property.address}</p>
      )}

      {property.surfaceM2 !== null && (
        <p className="text-xs text-gris-acero">
          {property.surfaceM2.toLocaleString()} {SURFACE_UNIT}
        </p>
      )}
    </Link>
  );
}
