import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@shared/components/empty-state/empty-state";
import { useProperty } from "@features/properties/hooks/use-property";
import type { PropertyStatus } from "@features/properties/types";

const STATUS_LABELS: Record<PropertyStatus, string> = {
  AVAILABLE: "Disponible",
  RESERVED: "Reservada",
  SOLD: "Vendida",
  INACTIVE: "Inactiva",
};

const STATUS_VARIANTS: Record<PropertyStatus, "default" | "secondary" | "destructive" | "outline"> = {
  AVAILABLE: "default",
  RESERVED: "secondary",
  SOLD: "outline",
  INACTIVE: "destructive",
};

export function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: property, isLoading, isError } = useProperty(id ?? "");

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (isError || !property) {
    return (
      <div className="p-4">
        <EmptyState
          title="Propiedad no encontrada"
          description="La propiedad que buscas no existe o fue eliminada."
          actionLabel="Volver"
          onAction={() => navigate(-1)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-lg font-semibold">{property.title}</h1>
        <Badge variant={STATUS_VARIANTS[property.status]}>
          {STATUS_LABELS[property.status]}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Detalles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {property.description && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Descripción</p>
              <p className="text-sm">{property.description}</p>
            </div>
          )}

          {property.address && (
            <>
              <Separator />
              <div>
                <p className="text-xs font-medium text-muted-foreground">Dirección</p>
                <p className="text-sm">{property.address}</p>
              </div>
            </>
          )}

          {property.surfaceM2 !== null && (
            <>
              <Separator />
              <div>
                <p className="text-xs font-medium text-muted-foreground">Superficie</p>
                <p className="text-sm">{property.surfaceM2.toLocaleString()} m²</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
