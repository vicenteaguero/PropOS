import { useParams, useNavigate } from "react-router-dom";
import { TopBar } from "@shared/components/top-bar/top-bar";
import { LoadingSpinner } from "@shared/components/loading-spinner/loading-spinner";
import { EmptyState } from "@shared/components/empty-state/empty-state";
import { useProperty } from "@features/properties/hooks/use-property";
import type { PropertyStatus } from "@features/properties/types";

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
const NOT_FOUND_TITLE = "Propiedad no encontrada";
const NOT_FOUND_DESC = "La propiedad que buscas no existe o fue eliminada.";
const BACK_LABEL = "Volver";

export function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: property, isLoading, isError } = useProperty(id ?? "");

  if (isLoading) {
    return (
      <div className="flex flex-col">
        <TopBar
          title="Cargando..."
          actions={
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="min-h-11 min-w-11 rounded-md px-3 py-2 text-sm text-gris-acero transition-colors duration-150 hover:text-blanco-nieve"
            >
              {BACK_LABEL}
            </button>
          }
        />
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (isError || !property) {
    return (
      <div className="flex flex-col">
        <TopBar title="Error" />
        <EmptyState
          title={NOT_FOUND_TITLE}
          description={NOT_FOUND_DESC}
          actionLabel={BACK_LABEL}
          onAction={() => navigate(-1)}
        />
      </div>
    );
  }

  const statusLabel = STATUS_LABELS[property.status];
  const statusColor = STATUS_COLORS[property.status];

  return (
    <div className="flex flex-col">
      <TopBar
        title={property.title}
        actions={
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="min-h-11 min-w-11 rounded-md px-3 py-2 text-sm text-gris-acero transition-colors duration-150 hover:text-blanco-nieve"
          >
            {BACK_LABEL}
          </button>
        }
      />

      <div className="flex flex-col gap-6 p-4">
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusColor}`}>
            {statusLabel}
          </span>
        </div>

        {property.description && (
          <div>
            <h2 className="mb-1 text-sm font-medium text-gris-acero">Descripci&oacute;n</h2>
            <p className="text-sm text-blanco-nieve">{property.description}</p>
          </div>
        )}

        {property.address && (
          <div>
            <h2 className="mb-1 text-sm font-medium text-gris-acero">Direcci&oacute;n</h2>
            <p className="text-sm text-blanco-nieve">{property.address}</p>
          </div>
        )}

        {property.surfaceM2 !== null && (
          <div>
            <h2 className="mb-1 text-sm font-medium text-gris-acero">Superficie</h2>
            <p className="text-sm text-blanco-nieve">
              {property.surfaceM2.toLocaleString()} {SURFACE_UNIT}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
