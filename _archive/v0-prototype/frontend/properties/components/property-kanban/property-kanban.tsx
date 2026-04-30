import { useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useState } from "react";
import { useProperties } from "@features/properties/hooks/use-properties";
import { useUpdatePropertyStatus } from "@features/properties/hooks/use-update-property-status";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@shared/components/empty-state/empty-state";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";
import type { Property, PropertyStatus } from "@features/properties/types";

const COLUMNS: { status: PropertyStatus; label: string; color: string }[] = [
  { status: "AVAILABLE", label: "Disponible", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  { status: "RESERVED", label: "Reservada", color: "bg-primary/15 text-primary border-primary/30" },
  { status: "SOLD", label: "Vendida", color: "bg-muted text-muted-foreground border-border" },
  { status: "INACTIVE", label: "Inactiva", color: "bg-destructive/15 text-red-400 border-destructive/30" },
];

interface KanbanCardProps {
  property: Property;
}

function KanbanCard({ property }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: property.id,
    data: { status: property.status },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`rounded-lg border border-border bg-card p-3 shadow-sm cursor-grab active:cursor-grabbing ${isDragging ? "opacity-50" : ""}`}
    >
      <p className="text-sm font-medium leading-tight">{property.title}</p>
      {property.address && (
        <p className="mt-1 text-xs text-muted-foreground">{property.address}</p>
      )}
      {property.surfaceM2 !== null && (
        <p className="mt-0.5 text-xs text-muted-foreground">
          {property.surfaceM2.toLocaleString()} m²
        </p>
      )}
    </div>
  );
}

function KanbanCardOverlay({ property }: KanbanCardProps) {
  return (
    <div className="rounded-lg border border-primary bg-card p-3 shadow-lg">
      <p className="text-sm font-medium leading-tight">{property.title}</p>
      {property.address && (
        <p className="mt-1 text-xs text-muted-foreground">{property.address}</p>
      )}
    </div>
  );
}

interface KanbanColumnProps {
  status: PropertyStatus;
  label: string;
  color: string;
  properties: Property[];
}

function KanbanColumn({ status, label, color, properties }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[200px] flex-col rounded-lg border bg-muted/30 ${isOver ? "border-primary/50 bg-primary/5" : "border-border"}`}
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <Badge variant="outline" className={color}>
          {label}
        </Badge>
        <span className="text-xs text-muted-foreground">{properties.length}</span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-2">
        {properties.map((property) => (
          <KanbanCard key={property.id} property={property} />
        ))}
      </div>
    </div>
  );
}

interface PropertyKanbanProps {
  searchQuery?: string;
  statusFilter?: PropertyStatus[];
}

export function PropertyKanban({ searchQuery = "", statusFilter = [] }: PropertyKanbanProps) {
  const { data: properties, isLoading, isError, refetch } = useProperties();
  const updateStatus = useUpdatePropertyStatus();
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const filtered = useMemo(() => {
    if (!properties) return [];
    let result = properties;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          (p.address?.toLowerCase().includes(q) ?? false) ||
          (p.description?.toLowerCase().includes(q) ?? false),
      );
    }
    if (statusFilter.length > 0) {
      result = result.filter((p) => statusFilter.includes(p.status));
    }
    return result;
  }, [properties, searchQuery, statusFilter]);

  const grouped = useMemo(() => {
    const map: Record<PropertyStatus, Property[]> = {
      AVAILABLE: [],
      RESERVED: [],
      SOLD: [],
      INACTIVE: [],
    };
    for (const p of filtered) {
      map[p.status].push(p);
    }
    return map;
  }, [filtered]);

  const activeProperty = activeId
    ? filtered.find((p) => p.id === activeId) ?? null
    : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const propertyId = active.id as string;
    const newStatus = over.id as PropertyStatus;
    const property = filtered.find((p) => p.id === propertyId);

    if (property && property.status !== newStatus && COLUMNS.some((c) => c.status === newStatus)) {
      updateStatus.mutate({ id: propertyId, status: newStatus });
    }
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2 rounded-lg border border-border p-3">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        title="Error al cargar"
        description="No se pudieron cargar las propiedades. Intentalo de nuevo."
        actionLabel="Reintentar"
        onAction={() => { refetch(); }}
      />
    );
  }

  if (!properties || properties.length === 0) {
    return (
      <EmptyState
        title="Sin propiedades"
        description="Aun no hay propiedades registradas en el sistema."
      />
    );
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {COLUMNS.map(({ status, label, color }) => (
          <KanbanColumn
            key={status}
            status={status}
            label={label}
            color={color}
            properties={grouped[status]}
          />
        ))}
      </div>
      <DragOverlay>
        {activeProperty ? <KanbanCardOverlay property={activeProperty} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
