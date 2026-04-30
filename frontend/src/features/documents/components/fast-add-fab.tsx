import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Camera, FilePlus2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@shared/hooks/use-auth";
import { documentsApi } from "../api/documents-api";
import { useCreateDocument } from "../hooks/use-documents";
import {
  useContacts,
  useCreateDraftContact,
  useCreateDraftProperty,
  useProperties,
} from "../hooks/use-entities";
import { CameraCaptureDocument } from "./camera-capture-document";
import { UploadDropzone } from "./upload-dropzone";

export function FastAddFab() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role.toLowerCase() ?? "agent";

  const [open, setOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [propertyTitle, setPropertyTitle] = useState("");
  const [contactName, setContactName] = useState("");
  const [busy, setBusy] = useState(false);

  const create = useCreateDocument();
  const createProperty = useCreateDraftProperty();
  const createContact = useCreateDraftContact();
  const { data: properties = [] } = useProperties(propertyTitle);
  const { data: contacts = [] } = useContacts(contactName);

  const reset = () => {
    setPendingFile(null);
    setDisplayName("");
    setPropertyTitle("");
    setContactName("");
  };

  const handleSelectFile = (file: File) => {
    setPendingFile(file);
    setDisplayName(file.name.replace(/\.[^/.]+$/, ""));
  };

  const handleCameraPdf = (bytes: Uint8Array) => {
    const file = new File([bytes], `escaneo-${Date.now()}.pdf`, {
      type: "application/pdf",
    });
    handleSelectFile(file);
  };

  const submit = async () => {
    if (!pendingFile || !displayName.trim()) {
      toast.error("Falta nombre o archivo");
      return;
    }
    setBusy(true);
    try {
      const doc = await create.mutateAsync({
        file: pendingFile,
        displayName,
        origin: pendingFile.type === "application/pdf" && pendingFile.name.startsWith("escaneo-") ? "CAMERA" : "UPLOAD",
      });

      const matchingProp = propertyTitle
        ? properties.find((p) => p.title.toLowerCase() === propertyTitle.toLowerCase())
        : null;
      if (propertyTitle.trim()) {
        const propertyId = matchingProp?.id ?? (await createProperty.mutateAsync(propertyTitle.trim())).id;
        await assignTo(doc.id, "PROPERTY", propertyId);
      }

      const matchingContact = contactName
        ? contacts.find((c) => c.full_name.toLowerCase() === contactName.toLowerCase())
        : null;
      if (contactName.trim()) {
        const contactId = matchingContact?.id ?? (await createContact.mutateAsync(contactName.trim())).id;
        await assignTo(doc.id, "CONTACT", contactId);
      }

      toast.success("Documento agregado");
      reset();
      setOpen(false);
      navigate(`/${role}/documents/${doc.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        size="icon"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-30 h-14 w-14 rounded-full shadow-lg shadow-primary/30 md:bottom-8 md:right-8"
        aria-label="Agregar rápido"
      >
        <Plus className="size-6" />
      </Button>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Documento rápido</DialogTitle>
          </DialogHeader>

          {!pendingFile && (
            <div className="space-y-3">
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => setCameraOpen(true)}
              >
                <Camera className="size-4" /> Escanear con cámara
              </Button>
              <div className="text-center text-xs text-muted-foreground">o</div>
              <UploadDropzone onFile={handleSelectFile} />
            </div>
          )}

          {pendingFile && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-md border border-border bg-card p-2 text-sm">
                <FilePlus2 className="size-4 text-primary/70" />
                <span className="flex-1 truncate">{pendingFile.name}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => setPendingFile(null)}
                >
                  <X className="size-3" />
                </Button>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nombre del documento</Label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Propiedad (existente o nueva como borrador)</Label>
                <Input
                  value={propertyTitle}
                  onChange={(e) => setPropertyTitle(e.target.value)}
                  placeholder="Av. Reñaca 115"
                  list="fab-properties"
                />
                <datalist id="fab-properties">
                  {properties.map((p) => (
                    <option key={p.id} value={p.title} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Contacto (existente o nuevo como borrador)</Label>
                <Input
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Jaime Pérez"
                  list="fab-contacts"
                />
                <datalist id="fab-contacts">
                  {contacts.map((c) => (
                    <option key={c.id} value={c.full_name} />
                  ))}
                </datalist>
              </div>
              <Button onClick={submit} disabled={busy} className="w-full">
                {busy ? "Subiendo..." : "Crear documento"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <CameraCaptureDocument
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onPdfReady={(bytes) => {
          setCameraOpen(false);
          handleCameraPdf(bytes);
        }}
      />
    </>
  );
}

async function assignTo(
  documentId: string,
  kind: "PROPERTY" | "CONTACT",
  id: string,
): Promise<void> {
  await documentsApi.addAssignment(documentId, {
    target_kind: kind,
    ...(kind === "PROPERTY" ? { property_id: id } : { contact_id: id }),
  });
}
