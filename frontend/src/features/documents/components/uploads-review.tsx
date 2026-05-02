import { useState } from "react";
import { toast } from "sonner";
import { Check, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useContacts, useInternalAreas, useProperties } from "../hooks/use-entities";
import { usePortalUploads, usePromoteUpload, useRejectUpload } from "../hooks/use-portals";
import type { AnonymousUpload, AssignmentTarget } from "../types";

interface Props {
  portalId: string;
  defaults: {
    propertyId?: string | null;
    contactId?: string | null;
    areaId?: string | null;
  };
}

export function UploadsReview({ portalId, defaults }: Props) {
  const { data: uploads = [], isLoading } = usePortalUploads(portalId);
  const promote = usePromoteUpload();
  const reject = useRejectUpload();

  const [target, setTarget] = useState<AnonymousUpload | null>(null);
  const [displayName, setDisplayName] = useState("");

  const { data: properties } = useProperties();
  const { data: contacts } = useContacts();
  const { data: areas } = useInternalAreas();

  const buildAssignments = () => {
    const items: Array<{
      target_kind: AssignmentTarget;
      contact_id?: string;
      property_id?: string;
      internal_area_id?: string;
    }> = [];
    if (defaults.propertyId)
      items.push({ target_kind: "PROPERTY", property_id: defaults.propertyId });
    if (defaults.contactId) items.push({ target_kind: "CONTACT", contact_id: defaults.contactId });
    if (defaults.areaId)
      items.push({ target_kind: "INTERNAL_AREA", internal_area_id: defaults.areaId });
    return items;
  };

  const startPromote = (u: AnonymousUpload) => {
    setTarget(u);
    setDisplayName(u.original_filename?.replace(/\.[^/.]+$/, "") || "Documento");
  };

  const confirmPromote = async () => {
    if (!target) return;
    try {
      await promote.mutateAsync({
        uploadId: target.id,
        portalId,
        body: { display_name: displayName, assignments: buildAssignments() },
      });
      toast.success("Documento aprobado");
      setTarget(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando...</p>;
  if (uploads.length === 0)
    return <p className="text-sm text-muted-foreground">No hay archivos pendientes de revisión.</p>;

  const labelDefault = (kind: "property" | "contact" | "area", id: string | null | undefined) => {
    if (!id) return null;
    if (kind === "property") return properties?.find((p) => p.id === id)?.title ?? id;
    if (kind === "contact") return contacts?.find((c) => c.id === id)?.full_name ?? id;
    return areas?.find((a) => a.id === id)?.name ?? id;
  };

  return (
    <>
      <ul className="space-y-2">
        {uploads.map((u) => (
          <li
            key={u.id}
            className="flex items-center gap-3 rounded-md border border-border bg-card p-3 text-sm"
          >
            <FileText className="size-5 text-primary/70" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{u.original_filename ?? "(sin nombre)"}</div>
              <div className="truncate text-xs text-muted-foreground">
                {u.uploader_label ? `${u.uploader_label} · ` : ""}
                {u.size_bytes ? `${(u.size_bytes / 1024).toFixed(0)} KB · ` : ""}
                {new Date(u.created_at).toLocaleString()}
              </div>
              <div className="truncate text-[10px] font-mono text-muted-foreground">
                {u.sha256?.slice(0, 16)}
              </div>
            </div>
            <div className="text-xs">
              <span
                className={
                  u.status === "approved"
                    ? "text-success"
                    : u.status === "rejected"
                      ? "text-destructive"
                      : "text-warning"
                }
              >
                {u.status}
              </span>
            </div>
            {u.status === "pending_review" && (
              <div className="flex gap-1">
                <Button size="sm" variant="secondary" onClick={() => startPromote(u)}>
                  <Check className="size-3" /> Aprobar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={async () => {
                    try {
                      await reject.mutateAsync({ uploadId: u.id, portalId });
                      toast.success("Rechazado");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Error");
                    }
                  }}
                >
                  <X className="size-3" />
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Aprobar y vincular</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Nombre del documento</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <div className="space-y-1 text-xs">
              <Label>Vínculos automáticos del enlace</Label>
              <ul className="rounded-md border border-border bg-muted/30 p-2 text-muted-foreground">
                {labelDefault("property", defaults.propertyId) && (
                  <li>Propiedad: {labelDefault("property", defaults.propertyId)}</li>
                )}
                {labelDefault("contact", defaults.contactId) && (
                  <li>Contacto: {labelDefault("contact", defaults.contactId)}</li>
                )}
                {labelDefault("area", defaults.areaId) && (
                  <li>Área: {labelDefault("area", defaults.areaId)}</li>
                )}
                {!defaults.propertyId && !defaults.contactId && !defaults.areaId && (
                  <li>Sin defaults configurados</li>
                )}
              </ul>
            </div>
            <Button onClick={confirmPromote} disabled={promote.isPending} className="w-full">
              Aprobar y crear documento
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
