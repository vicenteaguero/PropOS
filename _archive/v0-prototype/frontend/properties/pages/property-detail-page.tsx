import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Images, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@shared/components/empty-state/empty-state";
import { PageHeader } from "@shared/components/page-header/page-header";
import { ConfirmDialog } from "@shared/components/confirm-dialog/confirm-dialog";
import { PhotoGrid } from "@shared/components/photo-grid/photo-grid";
import { PhotoViewer } from "@shared/components/photo-viewer/photo-viewer";
import { PhotoPicker } from "@shared/components/photo-picker/photo-picker";
import { useProperty } from "@features/properties/hooks/use-property";
import { useDeleteProperty } from "@features/properties/hooks/use-delete-property";
import { useMediaFiles } from "@shared/hooks/use-media-files";
import { useAuth } from "@shared/hooks/use-auth";
import type { PropertyStatus } from "@features/properties/types";

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

export function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: property, isLoading, isError } = useProperty(id ?? "");
  const { photos, galleryPhotos, saveMediaFile } = useMediaFiles();
  const deleteMutation = useDeleteProperty();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [showUpload, setShowUpload] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const isAdmin = user?.role === "ADMIN";

  const allPhotos = [...photos, ...galleryPhotos];
  const slides = allPhotos.map((p) => ({ src: p.url }));

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
        <PageHeader
          title={property.title}
          actions={
            <>
              <Badge variant="outline" className={STATUS_STYLES[property.status]}>
                {STATUS_LABELS[property.status]}
              </Badge>
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </>
          }
        />
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

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Images className="size-4" />
            Fotos
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowUpload((v) => !v)}
          >
            {showUpload ? "Cancelar" : "Subir foto"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {showUpload && (
            <PhotoPicker
              onSaved={(url) => {
                saveMediaFile(url, "photo", "gallery");
                setShowUpload(false);
              }}
            />
          )}
          {allPhotos.length > 0 ? (
            <PhotoGrid
              photos={allPhotos}
              onPhotoClick={(index) => {
                setLightboxIndex(index);
                setLightboxOpen(true);
              }}
            />
          ) : (
            !showUpload && (
              <p className="text-center text-sm text-muted-foreground">
                No hay fotos. Sube la primera.
              </p>
            )
          )}
        </CardContent>
      </Card>

      <PhotoViewer
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        slides={slides}
        index={lightboxIndex}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Eliminar propiedad"
        description="Esta accion no se puede deshacer. La propiedad sera eliminada permanentemente."
        confirmLabel="Eliminar"
        variant="destructive"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (!id) return;
          deleteMutation.mutate(id, {
            onSuccess: () => navigate(-1),
          });
        }}
      />
    </div>
  );
}
