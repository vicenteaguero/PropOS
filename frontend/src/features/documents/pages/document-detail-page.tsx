import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  Download,
  FileQuestion,
  History,
  Pencil,
  Share2,
  Trash2,
  Link as LinkIcon,
  Camera,
  Cpu,
  ScanText,
  PenSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@shared/components/loading-spinner/loading-spinner";
import { PageLayout } from "@shared/components/page-layout";
import { useAuth } from "@shared/hooks/use-auth";
import { useDeleteDocument, useDocument } from "../hooks/use-documents";
import { useDocumentBlob } from "../hooks/use-document-blob";
import { DocumentPreview } from "../components/document-preview";
import { IntegrityWarning } from "../components/integrity-warning";
import { DeleteDocumentConfirm } from "../components/delete-confirm";
import { AssignmentList } from "../components/assignment-list";
import { AssignmentPicker } from "../components/assignment-picker";
import { ShareLinkDialog } from "../components/share-link-dialog";
import { ShareViaDialog } from "../components/share-via-dialog";
import { VersionHistoryDrawer } from "../components/version-history-drawer";

export function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role.toLowerCase() ?? "agent";

  const { data: doc, isLoading, error } = useDocument(id);
  const deleteMutation = useDeleteDocument();

  const currentVersion = doc?.current_version ?? doc?.versions?.[0] ?? null;
  const blobState = useDocumentBlob(id, currentVersion);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [shareLinkOpen, setShareLinkOpen] = useState(false);
  const [shareViaOpen, setShareViaOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const downloadName = useMemo(() => {
    const base = currentVersion?.download_filename || doc?.display_name || "documento";
    const mime = currentVersion?.mime_type ?? "";
    const extByMime: Record<string, string> = {
      "application/pdf": "pdf",
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/heic": "heic",
      "image/heif": "heif",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    };
    const wantedExt = extByMime[mime];
    if (!wantedExt) return base;
    const hasExt = /\.[a-z0-9]{2,5}$/i.test(base);
    if (hasExt) return base;
    return `${base}.${wantedExt}`;
  }, [currentVersion, doc]);

  if (isLoading) {
    return (
      <PageLayout width="lg">
        <div className="flex min-h-[40vh] justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </PageLayout>
    );
  }
  if (error || !doc) {
    const isNotFound =
      !error || (error instanceof Error && /404|not found|no encontrado/i.test(error.message));
    return (
      <PageLayout width="sm">
        <div className="flex flex-col items-center justify-center gap-4 text-center">
          <FileQuestion className="size-14 text-muted-foreground/50" strokeWidth={1.25} />
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {isNotFound ? "Documento no encontrado" : "No se pudo cargar"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {isNotFound
                ? "Es posible que se haya eliminado o que el enlace sea incorrecto."
                : error instanceof Error
                  ? error.message
                  : "Error al cargar el documento."}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="size-4" /> Volver
            </Button>
            <Button size="sm" onClick={() => navigate(`/${role}/documents`)}>
              Ir a documentos
            </Button>
          </div>
        </div>
      </PageLayout>
    );
  }

  const downloadCurrent = () => {
    if (!blobState.blob) return;
    const mime = currentVersion?.mime_type || "application/octet-stream";
    const typed =
      blobState.blob.type === mime ? blobState.blob : new Blob([blobState.blob], { type: mime });
    const url = URL.createObjectURL(typed);
    const a = document.createElement("a");
    a.href = url;
    a.download = downloadName;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const goEditor = () => navigate(`/${role}/documents/${doc.id}/edit`);

  return (
    <PageLayout width="lg">
      <div className="mb-4 flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold">{doc.display_name}</h1>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-xs">
              {doc.kind}
            </Badge>
            {currentVersion && (
              <>
                <Badge variant="outline" className="text-xs">
                  v{currentVersion.version_number}
                </Badge>
                <span className="font-mono">{currentVersion.sha256.slice(0, 12)}</span>
                <span>·</span>
                <span>{(currentVersion.size_bytes / 1024).toFixed(0)} KB</span>
                {currentVersion.page_count && (
                  <>
                    <span>·</span>
                    <span>{currentVersion.page_count} pág.</span>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={downloadCurrent} disabled={!blobState.blob}>
          <Download className="size-4" /> Descargar
        </Button>
        <Button size="sm" variant="secondary" onClick={goEditor}>
          <Pencil className="size-4" /> Editar
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setShareLinkOpen(true)}>
          <LinkIcon className="size-4" /> Shortlink
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setShareViaOpen(true)}>
          <Share2 className="size-4" /> Compartir
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setHistoryOpen(true)}>
          <History className="size-4" /> Versiones
        </Button>
        <Button size="sm" variant="ghost" disabled title="Próximamente">
          <ScanText className="size-4" /> OCR
        </Button>
        <Button size="sm" variant="ghost" disabled title="Próximamente">
          <Cpu className="size-4" /> Analizar IA
        </Button>
        <Button size="sm" variant="ghost" disabled title="Próximamente">
          <PenSquare className="size-4" /> Firmar
        </Button>
        <Button size="sm" variant="ghost" disabled title="Próximamente">
          <Camera className="size-4" /> Escanear
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="size-4" /> Eliminar
        </Button>
      </div>

      {!blobState.integrityOk && (
        <div className="mb-3">
          <IntegrityWarning />
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
        <div className="rounded-lg border border-border bg-card p-3">
          <DocumentPreview
            blob={blobState.blob}
            mimeType={currentVersion?.mime_type}
            loading={blobState.loading}
          />
        </div>
        <aside className="space-y-4">
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Vínculos</h3>
              <Button size="sm" variant="ghost" onClick={() => setPickerOpen(true)}>
                + Vincular
              </Button>
            </div>
            <AssignmentList documentId={doc.id} assignments={doc.assignments ?? []} />
          </section>
          <section>
            <h3 className="mb-2 text-sm font-semibold">Información</h3>
            <dl className="space-y-1 text-xs">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Origen</dt>
                <dd>{doc.origin}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Creado</dt>
                <dd>{new Date(doc.created_at).toLocaleString()}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Actualizado</dt>
                <dd>{new Date(doc.updated_at).toLocaleString()}</dd>
              </div>
              {currentVersion && (
                <>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">MIME</dt>
                    <dd>{currentVersion.mime_type}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Antivirus</dt>
                    <dd>{currentVersion.scan_status}</dd>
                  </div>
                </>
              )}
              {blobState.source && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Fuente</dt>
                  <dd>{blobState.source === "cache" ? "caché local" : "red"}</dd>
                </div>
              )}
            </dl>
          </section>
        </aside>
      </div>

      <AssignmentPicker documentId={doc.id} open={pickerOpen} onOpenChange={setPickerOpen} />
      <VersionHistoryDrawer
        documentId={doc.id}
        currentVersionId={doc.current_version_id}
        versions={doc.versions ?? []}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />
      <ShareLinkDialog
        documentId={doc.id}
        currentVersionId={doc.current_version_id}
        versions={doc.versions ?? []}
        open={shareLinkOpen}
        onOpenChange={setShareLinkOpen}
        onLinkReady={(url) => {
          setShareUrl(url);
          setShareViaOpen(true);
        }}
      />
      <ShareViaDialog
        open={shareViaOpen}
        onOpenChange={setShareViaOpen}
        url={shareUrl}
        title={doc.display_name}
      />
      <DeleteDocumentConfirm
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        documentName={doc.display_name}
        loading={deleteMutation.isPending}
        onConfirm={async () => {
          try {
            await deleteMutation.mutateAsync(doc.id);
            toast.success("Documento eliminado");
            navigate(`/${role}/documents`);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Error al eliminar");
          }
        }}
      />
    </PageLayout>
  );
}
