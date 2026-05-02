import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Folder, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@shared/components/page-header/page-header";
import { SearchInput } from "@shared/components/search-input/search-input";
import { LoadingSpinner } from "@shared/components/loading-spinner/loading-spinner";
import { EmptyState } from "@shared/components/empty-state/empty-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@shared/hooks/use-auth";
import { ViewModeToggle } from "../components/view-mode-toggle";
import { DocumentsGrid } from "../components/documents-grid";
import { DocumentsList } from "../components/documents-list";
import { UploadDropzone } from "../components/upload-dropzone";
import { FastAddFab } from "../components/fast-add-fab";
import { useCreateDocument, useDocuments } from "../hooks/use-documents";
import type { DocumentItem, ViewMode } from "../types";

const VIEW_MODE_KEY = "documents:view-mode";

function loadViewMode(): ViewMode {
  if (typeof window === "undefined") return "grid";
  return (localStorage.getItem(VIEW_MODE_KEY) as ViewMode) || "grid";
}

export function DocumentsPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role.toLowerCase() ?? "agent";

  const [viewMode, setViewMode] = useState<ViewMode>(loadViewMode);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const q = params.get("q") ?? "";
  const contactId = params.get("contact_id") ?? undefined;
  const propertyId = params.get("property_id") ?? undefined;
  const areaId = params.get("area_id") ?? undefined;

  const { data, isLoading, error } = useDocuments({
    contactId,
    propertyId,
    areaId,
    q: q || undefined,
  });
  const createMutation = useCreateDocument();

  const setViewModePersist = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
  };

  const setQuery = (next: string) => {
    const sp = new URLSearchParams(params);
    if (next) sp.set("q", next);
    else sp.delete("q");
    setParams(sp);
  };

  const openDocument = (doc: DocumentItem) => {
    navigate(`/${role}/documents/${doc.id}`);
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const displayName = file.name.replace(/\.[^/.]+$/, "");
      const doc = await createMutation.mutateAsync({ file, displayName });
      toast.success("Documento subido");
      setUploadOpen(false);
      navigate(`/${role}/documents/${doc.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al subir");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6">
      <PageHeader
        title="Documentos"
        description="Gestiona contratos, escrituras y archivos"
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/${role}/documents/portals`)}
            >
              <Folder className="size-4" /> Enlaces de subida
            </Button>
            <Button size="sm" onClick={() => setUploadOpen(true)}>
              <Plus className="size-4" /> Nuevo
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="min-w-[240px] flex-1">
          <SearchInput value={q} onChange={setQuery} placeholder="Buscar por nombre..." />
        </div>
        <ViewModeToggle value={viewMode} onChange={setViewModePersist} />
      </div>

      {(contactId || propertyId || areaId) && (
        <div className="mb-3 flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs">
          <Settings className="size-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Filtrando por entidad vinculada</span>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto h-6 text-xs"
            onClick={() => setParams(new URLSearchParams(q ? { q } : {}))}
          >
            Limpiar
          </Button>
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Error al cargar documentos: {error instanceof Error ? error.message : "desconocido"}
        </div>
      )}

      {!isLoading && !error && data && data.length === 0 && (
        <EmptyState
          title="Sin documentos"
          description="Sube tu primer documento PDF, DOCX o imagen para empezar."
          actionLabel="Nuevo documento"
          onAction={() => setUploadOpen(true)}
        />
      )}

      {!isLoading &&
        data &&
        data.length > 0 &&
        (viewMode === "grid" ? (
          <DocumentsGrid documents={data} onOpen={openDocument} />
        ) : (
          <DocumentsList documents={data} onOpen={openDocument} />
        ))}

      <FastAddFab />

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Subir documento</DialogTitle>
          </DialogHeader>
          <UploadDropzone onFile={handleUpload} disabled={uploading} />
          {uploading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoadingSpinner /> Subiendo...
            </div>
          )}
          <div className="space-y-2 text-xs text-muted-foreground">
            <Label>Nota</Label>
            <Input
              readOnly
              value="El nombre del archivo se usará como título inicial. Puedes editarlo después."
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
