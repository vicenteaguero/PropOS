import { useMemo } from "react";
import { useProperties } from "@features/properties/hooks/use-properties";
import { PropertyCard } from "@features/properties/components/property-card/property-card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@shared/components/empty-state/empty-state";
import type { Property, PropertyStatus } from "@features/properties/types";

interface PropertyListProps {
  basePath: string;
  searchQuery?: string;
  statusFilter?: PropertyStatus[];
}

function PropertyListSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="space-y-3 rounded-lg border border-border p-4">
          <div className="flex items-start justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-3 w-48" />
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

function matchesSearch(property: Property, query: string): boolean {
  const q = query.toLowerCase();
  return (
    property.title.toLowerCase().includes(q) ||
    (property.address?.toLowerCase().includes(q) ?? false) ||
    (property.description?.toLowerCase().includes(q) ?? false)
  );
}

export function PropertyList({ basePath, searchQuery = "", statusFilter = [] }: PropertyListProps) {
  const { data: properties, isLoading, isError, refetch } = useProperties();

  const filtered = useMemo(() => {
    if (!properties) return [];
    let result = properties;
    if (searchQuery) {
      result = result.filter((p) => matchesSearch(p, searchQuery));
    }
    if (statusFilter.length > 0) {
      result = result.filter((p) => statusFilter.includes(p.status));
    }
    return result;
  }, [properties, searchQuery, statusFilter]);

  if (isLoading) {
    return <PropertyListSkeleton />;
  }

  if (isError) {
    return (
      <EmptyState
        title="Error al cargar"
        description="No se pudieron cargar las propiedades. Inténtalo de nuevo."
        actionLabel="Reintentar"
        onAction={() => { refetch(); }}
      />
    );
  }

  if (!properties || properties.length === 0) {
    return (
      <EmptyState
        title="Sin propiedades"
        description="Aún no hay propiedades registradas en el sistema."
      />
    );
  }

  if (filtered.length === 0) {
    return (
      <EmptyState
        title="Sin resultados"
        description="No se encontraron propiedades con los filtros aplicados."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {filtered.map((property) => (
        <PropertyCard key={property.id} property={property} basePath={basePath} />
      ))}
    </div>
  );
}
