import { lazy, Suspense, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Camera, FilePlus2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useAuth } from "@shared/hooks/use-auth";
import { documentsApi } from "../api/documents-api";
import { useCreateDocument } from "../hooks/use-documents";
import type { ContactLite, PropertyLite } from "../types";
import type { SourceShot } from "./camera-capture-document";
import { EntityCombobox, type ManualEntry } from "./entity-combobox";
import {
  useContacts,
  useCreateDraftContact,
  useCreateDraftProperty,
  useProperties,
} from "../hooks/use-entities";

// Lazy-load the camera capture flow so the documents page chunk stays small.
// The scanner modules + dnd-kit only fetch when the user opens the camera.
const CameraCaptureDocument = lazy(() =>
  import("./camera-capture-document").then((m) => ({ default: m.CameraCaptureDocument })),
);
// Upload dropzone is light but only needed inside the dialog; defer it too.
const UploadDropzone = lazy(() =>
  import("./upload-dropzone").then((m) => ({ default: m.UploadDropzone })),
);

const QUICK_TAGS = ["ID", "Contrato", "Boleta", "Otro"] as const;
type QuickTag = (typeof QUICK_TAGS)[number];

function shortLabel(value: string, max = 24): string {
  const trimmed = value.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`;
}

function useFastAdd() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role.toLowerCase() ?? "agent";

  const [open, setOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [propertyTitle, setPropertyTitle] = useState("");
  const [selectedProperty, setSelectedProperty] = useState<PropertyLite | null>(null);
  const [contactName, setContactName] = useState("");
  const [selectedContact, setSelectedContact] = useState<ContactLite | null>(null);
  const [tag, setTag] = useState<QuickTag | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [origin, setOrigin] = useState<"UPLOAD" | "CAMERA">("UPLOAD");
  const [cameraSources, setCameraSources] = useState<SourceShot[] | null>(null);
  const [manualProperties, setManualProperties] = useState<ManualEntry[]>([]);
  const [manualContacts, setManualContacts] = useState<ManualEntry[]>([]);

  const create = useCreateDocument();
  const createProperty = useCreateDraftProperty();
  const createContact = useCreateDraftContact();
  // Only fetch entity lists once the dialog is open with a pending file —
  // avoids two extra round-trips on every documents-page mount.
  // Fetch entity suggestions while either the upload dialog (after a file is
  // picked) or the camera capture flow is open — the latter renders an inline
  // finalize overlay that needs the same property/contact lists.
  const entitiesEnabled = (open && !!pendingFile) || cameraOpen;
  const { data: properties = [], isFetching: loadingProperties } = useProperties(propertyTitle, {
    enabled: entitiesEnabled,
  });
  const { data: contacts = [], isFetching: loadingContacts } = useContacts(contactName, {
    enabled: entitiesEnabled,
    propertyId: selectedProperty?.id,
  });

  // Smart filename auto-suggest: when both property + contact are filled and
  // the user hasn't manually edited the name yet, derive it from the picks.
  useEffect(() => {
    if (nameTouched) return;
    if (!propertyTitle.trim() || !contactName.trim()) return;
    const next = `${shortLabel(propertyTitle)} — ${shortLabel(contactName)} — ${tag ?? "Documento"}`;
    setDisplayName(next);
  }, [propertyTitle, contactName, tag, nameTouched]);

  const reset = () => {
    setPendingFile(null);
    setDisplayName("");
    setNameTouched(false);
    setPropertyTitle("");
    setSelectedProperty(null);
    setContactName("");
    setSelectedContact(null);
    setTag(undefined);
    setOrigin("UPLOAD");
    setCameraSources(null);
    setManualProperties([]);
    setManualContacts([]);
  };

  const handleSelectFile = (file: File) => {
    setPendingFile(file);
    setDisplayName(file.name.replace(/\.[^/.]+$/, ""));
    setNameTouched(true);
    setOrigin("UPLOAD");
  };

  // Camera flow: open the same naming dialog so the user can choose name +
  // assignments before upload. Same submit() handler runs the upload, plus the
  // original camera shots are persisted so the document can be re-edited later.
  const handleCameraPdf = (bytes: Uint8Array, sources: SourceShot[]) => {
    const file = new File([bytes], `escaneo-${Date.now()}.pdf`, {
      type: "application/pdf",
    });
    const name = `Escaneo ${new Date().toLocaleDateString("es-CL")}`;
    setPendingFile(file);
    setDisplayName(name);
    setNameTouched(true);
    setOrigin("CAMERA");
    setCameraSources(sources);
    setCameraOpen(false);
    setOpen(true);
  };

  const submit = async () => {
    if (!pendingFile || !displayName.trim()) {
      toast.error("Falta nombre o archivo");
      return;
    }
    setBusy(true);
    let createdDocId: string | null = null;
    try {
      const doc = await create.mutateAsync({
        file: pendingFile,
        displayName,
        origin,
        tag,
        sourceImages: cameraSources?.map((s) => s.raw),
        sourceEditStates: cameraSources?.map((s) => ({
          quad: s.edit.quad,
          filter: s.edit.filter,
          bezierControls: s.edit.bezierControls,
        })),
      });
      createdDocId = doc.id;

      const assignments: Promise<unknown>[] = [];
      if (propertyTitle.trim()) {
        const propertyId =
          selectedProperty?.id ??
          properties.find(
            (p) => p.title.trim().toLowerCase() === propertyTitle.trim().toLowerCase(),
          )?.id ??
          (await createProperty.mutateAsync(propertyTitle.trim())).id;
        assignments.push(assignTo(doc.id, "PROPERTY", propertyId));
      }
      if (contactName.trim()) {
        const contactId =
          selectedContact?.id ??
          contacts.find(
            (c) => c.full_name.trim().toLowerCase() === contactName.trim().toLowerCase(),
          )?.id ??
          (await createContact.mutateAsync(contactName.trim())).id;
        assignments.push(assignTo(doc.id, "CONTACT", contactId));
      }
      await Promise.all(assignments);

      toast.success("Documento agregado");
      reset();
      setOpen(false);
      navigate(`/${role}/documents/${doc.id}`);
    } catch (e) {
      if (createdDocId) {
        documentsApi.remove(createdDocId).catch(() => undefined);
      }
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  return {
    open,
    setOpen: (o: boolean) => {
      setOpen(o);
      if (!o) reset();
    },
    cameraOpen,
    setCameraOpen,
    pendingFile,
    setPendingFile,
    displayName,
    setDisplayName,
    setNameTouched,
    propertyTitle,
    setPropertyTitle,
    selectedProperty,
    setSelectedProperty,
    contactName,
    setContactName,
    setSelectedContact,
    tag,
    setTag,
    properties,
    contacts,
    loadingProperties,
    loadingContacts,
    manualProperties,
    setManualProperties,
    manualContacts,
    setManualContacts,
    busy,
    submit,
    handleSelectFile,
    handleCameraPdf,
  };
}

function FastAddDialogBody(state: ReturnType<typeof useFastAdd>) {
  const {
    open,
    setOpen,
    cameraOpen,
    setCameraOpen,
    pendingFile,
    setPendingFile,
    displayName,
    setDisplayName,
    setNameTouched,
    propertyTitle,
    setPropertyTitle,
    selectedProperty,
    setSelectedProperty,
    contactName,
    setContactName,
    setSelectedContact,
    tag,
    setTag,
    properties,
    contacts,
    loadingProperties,
    loadingContacts,
    manualProperties,
    setManualProperties,
    manualContacts,
    setManualContacts,
    busy,
    submit,
    handleSelectFile,
    handleCameraPdf,
  } = state;

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo documento</DialogTitle>
          </DialogHeader>

          {!pendingFile && (
            <div className="space-y-3">
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => {
                  setOpen(false);
                  setCameraOpen(true);
                }}
              >
                <Camera className="size-4" /> Escanear con cámara
              </Button>
              <div className="text-center text-xs text-muted-foreground">o</div>
              <Suspense
                fallback={
                  <div className="h-24 animate-pulse rounded-md border border-dashed border-border bg-muted/30" />
                }
              >
                <UploadDropzone onFile={handleSelectFile} />
              </Suspense>
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
                <Input
                  value={displayName}
                  onChange={(e) => {
                    setDisplayName(e.target.value);
                    setNameTouched(true);
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Propiedad (existente o nueva como borrador)</Label>
                <EntityCombobox<PropertyLite>
                  value={propertyTitle}
                  onChange={(text) => {
                    setPropertyTitle(text);
                    if (selectedProperty && text.trim() !== selectedProperty.title.trim()) {
                      setSelectedProperty(null);
                    }
                  }}
                  onSelect={(p) => setSelectedProperty(p)}
                  items={properties}
                  getLabel={(p) => p.title}
                  getKey={(p) => p.id}
                  loading={loadingProperties}
                  placeholder="Av. Reñaca 115"
                  emptyText="Sin propiedades"
                  manualEntries={manualProperties}
                  onAddNew={(text) => {
                    setSelectedProperty(null);
                    setPropertyTitle(text);
                    setManualProperties((prev) =>
                      prev.some((m) => m.label.toLowerCase() === text.toLowerCase())
                        ? prev
                        : [...prev, { label: text, key: text.toLowerCase() }],
                    );
                  }}
                  ariaLabel="Seleccionar propiedad"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Contacto (existente o nuevo como borrador)</Label>
                <EntityCombobox<ContactLite>
                  value={contactName}
                  onChange={setContactName}
                  onSelect={(c) => setSelectedContact(c)}
                  items={contacts}
                  getLabel={(c) => c.full_name}
                  getKey={(c) => c.id}
                  loading={loadingContacts}
                  placeholder="Jaime Pérez"
                  emptyText="Sin contactos"
                  manualEntries={manualContacts}
                  onAddNew={(text) => {
                    setSelectedContact(null);
                    setContactName(text);
                    setManualContacts((prev) =>
                      prev.some((m) => m.label.toLowerCase() === text.toLowerCase())
                        ? prev
                        : [...prev, { label: text, key: text.toLowerCase() }],
                    );
                  }}
                  ariaLabel="Seleccionar contacto"
                />
                {selectedProperty && (
                  <p className="text-[11px] text-muted-foreground">
                    Filtrado por {selectedProperty.title}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Etiqueta</Label>
                <div className="flex flex-wrap gap-2">
                  {QUICK_TAGS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTag(tag === t ? undefined : t)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs transition",
                        tag === t
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <Button onClick={submit} disabled={busy} className="w-full">
                {busy ? "Subiendo..." : "Crear documento"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {cameraOpen && (
        <Suspense fallback={null}>
          <CameraCaptureDocument
            open={cameraOpen}
            onOpenChange={setCameraOpen}
            onPdfReady={(bytes, sources) => {
              setCameraOpen(false);
              handleCameraPdf(bytes, sources);
            }}
            propertySuggestions={properties}
            contactSuggestions={contacts}
            onPropertyQueryChange={setPropertyTitle}
            onContactQueryChange={setContactName}
            onPropertySelect={setSelectedProperty}
            loadingProperties={loadingProperties}
            loadingContacts={loadingContacts}
          />
        </Suspense>
      )}
    </>
  );
}

export function NewDocumentButton() {
  const state = useFastAdd();
  return (
    <>
      <Button size="sm" onClick={() => state.setOpen(true)}>
        <Plus className="size-4" /> Nuevo documento
      </Button>
      <FastAddDialogBody {...state} />
    </>
  );
}

export function AddDocumentCard() {
  const state = useFastAdd();
  return (
    <>
      <button
        type="button"
        onClick={() => state.setOpen(true)}
        className="group flex w-full items-center gap-4 rounded-xl border border-border bg-card p-5 text-left transition hover:border-primary/50 hover:bg-card/80"
      >
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition group-hover:bg-primary/20">
          <Plus className="size-6" />
        </span>
        <span className="flex-1">
          <span className="block text-base font-semibold text-foreground">Añadir documento</span>
          <span className="block text-sm text-muted-foreground">
            Sube un archivo o escanea con la cámara
          </span>
        </span>
      </button>
      <FastAddDialogBody {...state} />
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
