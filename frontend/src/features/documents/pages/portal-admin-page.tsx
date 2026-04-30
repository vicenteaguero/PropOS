import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ExternalLink, Folder, Plus, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoadingSpinner } from "@shared/components/loading-spinner/loading-spinner";
import { EmptyState } from "@shared/components/empty-state/empty-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDeletePortal, usePortals } from "../hooks/use-portals";
import { portalsApi } from "../api/portals-api";
import { PortalFormDialog } from "../components/portal-form-dialog";
import { UploadsReview } from "../components/uploads-review";

export function PortalAdminPage() {
  const navigate = useNavigate();
  const { data: portals, isLoading } = usePortals();
  const deletePortal = useDeletePortal();
  const [createOpen, setCreateOpen] = useState(false);
  const [qrOf, setQrOf] = useState<{ slug: string; title: string } | null>(null);

  return (
    <div className="container mx-auto max-w-5xl px-4 py-6">
      <div className="mb-4 flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="flex-1 text-lg font-semibold">Enlaces de subida anónima</h1>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" /> Nuevo enlace
        </Button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-8">
          <LoadingSpinner />
        </div>
      )}

      {!isLoading && portals && portals.length === 0 && (
        <EmptyState
          title="Sin enlaces"
          description="Crea un enlace para recibir documentos desde fuera del equipo."
          actionLabel="Crear enlace"
          onAction={() => setCreateOpen(true)}
        />
      )}

      <div className="space-y-4">
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
                  <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
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
                    onClick={async () => {
                      if (!confirm(`Eliminar enlace "${p.title}"?`)) return;
                      try {
                        await deletePortal.mutateAsync(p.id);
                        toast.success("Enlace eliminado");
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Error");
                      }
                    }}
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
    </div>
  );
}
