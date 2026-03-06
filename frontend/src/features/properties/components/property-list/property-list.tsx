import { useProperties } from "@features/properties/hooks/use-properties";
import { PropertyCard } from "@features/properties/components/property-card/property-card";
import { LoadingSpinner } from "@shared/components/loading-spinner/loading-spinner";
import { EmptyState } from "@shared/components/empty-state/empty-state";

interface PropertyListProps {
  basePath: string;
}

const EMPTY_TITLE = "Sin propiedades";
const EMPTY_DESCRIPTION = "A\u00FAn no hay propiedades registradas en el sistema.";
const ERROR_TITLE = "Error al cargar";
const ERROR_DESCRIPTION = "No se pudieron cargar las propiedades. Int\u00E9ntalo de nuevo.";

export function PropertyList({ basePath }: PropertyListProps) {
  const { data: properties, isLoading, isError, refetch } = useProperties();

  if (isLoading) {
    return <LoadingSpinner size="lg" />;
  }

  if (isError) {
    return (
      <EmptyState
        title={ERROR_TITLE}
        description={ERROR_DESCRIPTION}
        actionLabel="Reintentar"
        onAction={() => { refetch(); }}
      />
    );
  }

  if (!properties || properties.length === 0) {
    return <EmptyState title={EMPTY_TITLE} description={EMPTY_DESCRIPTION} />;
  }

  return (
    <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
      {properties.map((property) => (
        <PropertyCard key={property.id} property={property} basePath={basePath} />
      ))}
    </div>
  );
}
