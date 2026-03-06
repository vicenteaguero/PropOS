import { useState } from "react";
import { Link } from "react-router-dom";
import { MoreVertical, Eye, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@shared/components/confirm-dialog/confirm-dialog";
import { useDeleteProperty } from "@features/properties/hooks/use-delete-property";
import { useAuth } from "@shared/hooks/use-auth";
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

const STATUS_STYLES: Record<PropertyStatus, string> = {
  AVAILABLE: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  RESERVED: "bg-primary/15 text-primary border-primary/30",
  SOLD: "bg-muted text-muted-foreground border-border",
  INACTIVE: "bg-destructive/15 text-red-400 border-destructive/30",
};

export function PropertyCard({ property, basePath }: PropertyCardProps) {
  const { user } = useAuth();
  const deleteMutation = useDeleteProperty();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const isAdmin = user?.role === "ADMIN";

  return (
    <>
      <Link to={`${basePath}/${property.id}`}>
        <Card className="border-l-2 border-l-primary/30 transition-colors hover:border-primary/40 hover:border-l-primary">
          <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold leading-tight">
              {property.title}
            </CardTitle>
            <div className="flex items-center gap-1">
              <Badge variant="outline" className={STATUS_STYLES[property.status]}>
                {STATUS_LABELS[property.status]}
              </Badge>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    onClick={(e) => e.preventDefault()}
                  >
                    <MoreVertical className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.preventDefault()}>
                  <DropdownMenuItem asChild>
                    <Link to={`${basePath}/${property.id}`}>
                      <Eye className="size-4" />
                      Ver detalles
                    </Link>
                  </DropdownMenuItem>
                  {isAdmin && (
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setDeleteOpen(true)}
                    >
                      <Trash2 className="size-4" />
                      Eliminar
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
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

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Eliminar propiedad"
        description={`Se eliminara "${property.title}" permanentemente. Esta accion no se puede deshacer.`}
        confirmLabel="Eliminar"
        variant="destructive"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          deleteMutation.mutate(property.id, {
            onSuccess: () => setDeleteOpen(false),
          });
        }}
      />
    </>
  );
}
