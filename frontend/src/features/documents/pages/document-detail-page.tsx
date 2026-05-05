import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  Camera,
  Cpu,
  Download,
  FileQuestion,
  History,
  Link as LinkIcon,
  Loader2,
  MoreHorizontal,
  Pencil,
  PenSquare,
  ScanText,
  Share2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageLayout } from "@shared/components/page-layout";
import { useAuth } from "@shared/hooks/use-auth";
import { useAddVersion, useDeleteDocument, useDocument } from "../hooks/use-documents";
import { documentsApi } from "../api/documents-api";
import {
  CameraCaptureDocument,
  type BezierControls,
  type SourceShot,
} from "../components/camera-capture-document";
import type { Quad, FilterMode } from "../services/scanner/types";
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
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerShots, setScannerShots] = useState<SourceShot[] | null>(null);
  const [scannerLoading, setScannerLoading] = useState(false);
  const addVersion = useAddVersion(id ?? "");

  const hasSourceImages = !!currentVersion?.source_image_paths?.length;

  const openScannerReedit = async () => {
    if (!doc || !currentVersion?.id) return;
    setScannerLoading(true);
    try {
      const { urls, edit_states } = await documentsApi.getSourceImages(doc.id, currentVersion.id);
      const shots: SourceShot[] = [];
      for (let i = 0; i < urls.length; i++) {
        const res = await fetch(urls[i]!);
        if (!res.ok) throw new Error(`No se pudo descargar la imagen ${i + 1}`);
        const raw = await res.blob();
        const state = (edit_states[i] ?? {}) as {
          quad?: Quad;
          filter?: FilterMode;
          bezierControls?: BezierControls;
        };
        shots.push({
          raw,
          edit: {
            quad: state.quad ?? [
              { x: 0, y: 0 },
              { x: 1, y: 0 },
              { x: 1, y: 1 },
              { x: 0, y: 1 },
            ],
            filter: state.filter ?? "none",
            bezierControls: state.bezierControls,
          },
        });
      }
      setScannerShots(shots);
      setScannerOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error cargando páginas");
    } finally {
      setScannerLoading(false);
    }
  };

  const handleScannerPdf = async (bytes: Uint8Array, sources: SourceShot[]) => {
    if (!doc) return;
    try {
      const file = new File([bytes], `escaneo-${Date.now()}.pdf`, { type: "application/pdf" });
      await addVersion.mutateAsync({
        file,
        sourceImages: sources.map((s) => s.raw),
        sourceEditStates: sources.map((s) => ({
          quad: s.edit.quad,
          filter: s.edit.filter,
          bezierControls: s.edit.bezierControls,
        })),
      });
      toast.success("Nueva versión guardada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error guardando versión");
    }
  };

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
        <div className="mb-4 flex items-center gap-2">
          <Skeleton className="size-8" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-[3fr_1fr]">
          <Skeleton className="h-[60vh] w-full rounded-lg" />
          <aside className="space-y-5">
            <section className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </section>
            <section className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
              <Skeleton className="h-3 w-4/6" />
            </section>
          </aside>
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

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={downloadCurrent} disabled={!blobState.blob}>
          {blobState.loading && !blobState.blob ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}{" "}
          Descargar
        </Button>
        {hasSourceImages ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={openScannerReedit}
            disabled={scannerLoading}
          >
            {scannerLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Camera className="size-4" />
            )}
            {scannerLoading ? "Cargando…" : "Recortar"}
          </Button>
        ) : null}
        <Button size="sm" variant="secondary" onClick={goEditor}>
          <Pencil className="size-4" /> Editar
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setShareViaOpen(true)}>
          <Share2 className="size-4" /> Compartir
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setHistoryOpen(true)}>
          <History className="size-4" /> Versiones
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" aria-label="Más acciones">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48">
            <DropdownMenuItem onClick={() => setShareLinkOpen(true)}>
              <LinkIcon className="size-4" /> Shortlink
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <ScanText className="size-4" /> OCR · Próximamente
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <Cpu className="size-4" /> Analizar IA · Próximamente
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <PenSquare className="size-4" /> Firmar · Próximamente
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="size-4" /> Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {!blobState.integrityOk && (
        <div className="mb-3">
          <IntegrityWarning />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[3fr_1fr]">
        <div className="overflow-hidden rounded-lg bg-card/40">
          <DocumentPreview
            blob={blobState.blob}
            mimeType={currentVersion?.mime_type}
            loading={blobState.loading}
          />
        </div>
        <aside className="space-y-5">
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Vínculos
              </h3>
              <Button size="sm" variant="ghost" onClick={() => setPickerOpen(true)}>
                + Vincular
              </Button>
            </div>
            <AssignmentList documentId={doc.id} assignments={doc.assignments ?? []} />
          </section>
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Información
            </h3>
            <dl className="space-y-1.5 text-xs">
              <InfoRow label="Origen" value={doc.origin} />
              <InfoRow label="Creado" value={new Date(doc.created_at).toLocaleString()} />
              <InfoRow label="Actualizado" value={new Date(doc.updated_at).toLocaleString()} />
              {currentVersion && (
                <>
                  <InfoRow label="MIME" value={currentVersion.mime_type} />
                  <InfoRow label="Antivirus" value={currentVersion.scan_status} />
                </>
              )}
              {blobState.source && (
                <InfoRow
                  label="Fuente"
                  value={blobState.source === "cache" ? "caché local" : "red"}
                />
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
      {scannerOpen && scannerShots && (
        <CameraCaptureDocument
          open={scannerOpen}
          onOpenChange={(o) => {
            setScannerOpen(o);
            if (!o) setScannerShots(null);
          }}
          initialShots={scannerShots}
          showFinalizeOverlay={false}
          onPdfReady={async (bytes, sources) => {
            await handleScannerPdf(bytes, sources);
            setScannerOpen(false);
            setScannerShots(null);
          }}
        />
      )}
    </PageLayout>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate text-right font-mono">{value}</dd>
    </div>
  );
}
