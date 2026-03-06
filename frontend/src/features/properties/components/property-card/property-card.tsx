import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

const STATUS_VARIANTS: Record<PropertyStatus, "default" | "secondary" | "destructive" | "outline"> = {
  AVAILABLE: "default",
  RESERVED: "secondary",
  SOLD: "outline",
  INACTIVE: "destructive",
};

export function PropertyCard({ property, basePath }: PropertyCardProps) {
  return (
    <Link to={`${basePath}/${property.id}`}>
      <Card className="transition-colors hover:border-primary/40">
        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-sm font-semibold leading-tight">
            {property.title}
          </CardTitle>
          <Badge variant={STATUS_VARIANTS[property.status]}>
            {STATUS_LABELS[property.status]}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-1">
          {property.address && (
            <p className="text-xs text-muted-foreground">{property.address}</p>
          )}
          {property.surfaceM2 !== null && (
            <p className="text-xs text-muted-foreground">
              {property.surfaceM2.toLocaleString()} m²
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
