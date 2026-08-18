import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ExternalLink, Folder, Plus, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@shared/components/empty-state/empty-state";
import { ErrorState, PageSkeleton } from "@shared/ui";
import { PageLayout } from "@shared/components/page-layout";
import { PageHeader } from "@shared/components/page-header";
import { ConfirmDialog } from "@shared/components/confirm-dialog/confirm-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useIsDesktop } from "@/hooks/use-mobile";
import { useDeletePortal, usePortals } from "../hooks/use-portals";
import { portalsApi } from "../api/portals-api";
import { PortalFormDialog } from "../components/portal-form-dialog";
import { UploadsReview } from "../components/uploads-review";

export function PortalAdminPage() {
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const { data: portals, isLoading, error, refetch } = usePortals();
  const deletePortal = useDeletePortal();
  const [createOpen, setCreateOpen] = useState(false);
  const [qrOf, setQrOf] = useState<{ slug: string; title: string } | null>(null);
  const [toDelete, setToDelete] = useState<{ id: string; title: string } | null>(null);

  return (
    // Desktop fills the app surface; mobile keeps the capped reading column.
    <PageLayout width={isDesktop ? "app" : "lg"}>
      <PageHeader
        title="Enlaces de subida anónima"
        description="Crea enlaces públicos para recibir documentos desde fuera del equipo."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="size-4" /> Volver
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" /> Nuevo enlace
            </Button>
          </>
        }
      />

      {isLoading && <PageSkeleton variant="list" count={3} className="py-4" />}

      {/* Without this branch a failed load renders neither list, nor empty, nor
          error — just the header over blank space. */}
      {error && (
        <ErrorState
          message="No se pudieron cargar los enlaces."
          error={error}
          onRetry={() => refetch()}
        />
      )}

      {!isLoading && !error && portals && portals.length === 0 && (
        <EmptyState
          title="Sin enlaces"
          description="Crea un enlace para recibir documentos desde fuera del equipo."
          actionLabel="Crear enlace"
          onAction={() => setCreateOpen(true)}
        />
      )}

      {/* Cards carry a variable-height uploads list, so desktop uses a CSS
          masonry (columns) that packs them naturally instead of a rigid grid
          with ragged row heights. Mobile stays a single stacked column. */}
      <div className="space-y-4 lg:columns-2 lg:gap-4 lg:space-y-0 2xl:columns-3 lg:[&>*]:mb-4 lg:[&>*]:break-inside-avoid">
        {portals?.map((p) => {
          const url = portalsApi.publicUrl(p.slug);
          return (
            <Card key={p.id} className="p-4">
              <div className="flex flex-wrap items-start gap-3">
                <Folder className="mt-0.5 size-5 text-primary/70" />
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold">{p.title}</h3>
                  {p.description && (
                    <p className="text-xs text-muted-foreground">{p.description}</p>
                  )}
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="rounded bg-muted px-1.5 py-0.5">{p.access_mode}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5">
                      {p.max_file_size_mb} MB max
                    </span>
                    {p.has_password && (
                      <span className="rounded bg-muted px-1.5 py-0.5">password</span>
                    )}
                    {!p.is_active && (
                      <span className="rounded bg-destructive/20 px-1.5 py-0.5 text-destructive">
                        inactivo
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" asChild>
                    <a href={url} target="_blank" rel="noreferrer">
                      <ExternalLink className="size-4" />
                    </a>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setQrOf({ slug: p.slug, title: p.title })}
                  >
                    <QrCode className="size-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => setToDelete({ id: p.id, title: p.title })}
                  >
                    Eliminar
                  </Button>
                </div>
              </div>
              <div className="mt-3">
                <UploadsReview
                  portalId={p.id}
                  defaults={{
                    propertyId: p.default_property_id,
                    contactId: p.default_contact_id,
                    areaId: p.default_internal_area_id,
                  }}
                />
              </div>
            </Card>
          );
        })}
      </div>

      <PortalFormDialog open={createOpen} onOpenChange={setCreateOpen} />

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Eliminar enlace"
        description={`Se eliminará "${toDelete?.title ?? ""}". El enlace dejará de recibir documentos.`}
        confirmLabel="Eliminar"
        variant="destructive"
        loading={deletePortal.isPending}
        onConfirm={async () => {
          if (!toDelete) return;
          try {
            await deletePortal.mutateAsync(toDelete.id);
            toast.success("Enlace eliminado");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Error");
          } finally {
            setToDelete(null);
          }
        }}
      />

      <Dialog open={!!qrOf} onOpenChange={(o) => !o && setQrOf(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>QR — {qrOf?.title}</DialogTitle>
          </DialogHeader>
          {qrOf && (
            <div className="flex flex-col items-center gap-3">
              <QRCodeSVG value={portalsApi.publicUrl(qrOf.slug)} size={220} />
              <code className="break-all text-xs">{portalsApi.publicUrl(qrOf.slug)}</code>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
