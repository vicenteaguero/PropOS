import { useEffect, useMemo, useRef, useState } from "react";
import { useShellMode } from "@shared/hooks/use-shell-mode";
import { label } from "@shared/lib/labels";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  Camera,
  ChevronRight,
  Cpu,
  Download,
  FileQuestion,
  History,
  Link as LinkIcon,
  Loader2,
  MoreHorizontal,
  Pencil,
  Star,
  PenSquare,
  ScanText,
  Share2,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Pill, RoundButton, SectionLabel } from "@shared/ui";
import { PageLayout } from "@shared/components/page-layout";
import { useAuth } from "@shared/hooks/use-auth";
import {
  useAddVersion,
  useDeleteDocument,
  useDocument,
  useUpdateDocument,
} from "../hooks/use-documents";
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
import { DocumentSharePanel } from "../components/share-panel";
import { Users } from "lucide-react";
import { usePageTitle } from "@app/page-meta";
import { useTopbarOwnsSearch } from "@layouts/topbar-slot";
import { formatDateTime } from "@shared/utils/format";

export function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const shellOwnsBack = useShellMode() === "bottom-nav";
  const { user } = useAuth();
  const role = user?.role.toLowerCase() ?? "agent";

  const { data: doc, isLoading, error } = useDocument(id);
  // "Documento", not the file's name: the bar was printing the same string the
  // page prints one line below it, both truncated, so the only place the full
  // name appeared was a tooltip nobody can open on a phone.
  usePageTitle("Documento");
  // There is nothing to search on this screen, and the magnifier was occupying
  // the one slot the overflow menu should have.
  useTopbarOwnsSearch(true);
  // Stamp the open so "Usados hace poco" in the list means something. Fire and
  // forget: a document must still open if the stamp fails.
  const openedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!id || openedFor.current === id) return;
    openedFor.current = id;
    void documentsApi.markOpened(id).catch(() => {});
  }, [id]);

  const deleteMutation = useDeleteDocument();
  const updateMutation = useUpdateDocument(id ?? "");

  const togglePriority = () => {
    if (!doc) return;
    updateMutation.mutate(
      { is_priority: !doc.is_priority },
      { onError: () => toast.error("No se pudo cambiar la prioridad") },
    );
  };

  const togglePinOffline = async () => {
    if (!doc) return;
    const next = !doc.pin_offline;
    await updateMutation.mutateAsync({ pin_offline: next });
    if (next && doc.current_version?.normalized_path) {
      // Warm Workbox cache: fetch the signed URL so the SW caches the blob.
      try {
        const { url } = await documentsApi.versionDownloadUrl(doc.id, doc.current_version.id);
        await fetch(url, { mode: "cors" }).catch(() => {});
        if (doc.current_version.thumbnail_url) {
          await fetch(doc.current_version.thumbnail_url, { mode: "cors" }).catch(() => {});
        }
        toast.success("Disponible sin conexión");
      } catch {
        toast.warning("Marcado, pero no pude pre-descargar el blob");
      }
    } else {
      toast.success(next ? "Disponible sin conexión" : "Pin offline desactivado");
    }
  };

  const currentVersion = doc?.current_version ?? doc?.versions?.[0] ?? null;
  const blobState = useDocumentBlob(id, currentVersion);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [shareLinkOpen, setShareLinkOpen] = useState(false);
  const [shareViaOpen, setShareViaOpen] = useState(false);
  const [audienceShareOpen, setAudienceShareOpen] = useState(false);
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
      {/* Back is hidden in the phone shell, whose top bar carries one on every
          route below a section root. See useShellMode. */}
      <div className="mb-4 flex items-start gap-3">
        {!shellOwnsBack && (
          <RoundButton tone="muted" onClick={() => navigate(-1)} aria-label="Volver">
            <ArrowLeft className="size-[18px]" strokeWidth={1.8} />
          </RoundButton>
        )}
        <div className="min-w-0 flex-1 pt-1">
          {/* Wraps. It used to `truncate`, so a document whose name carries the
              contract number AND the property — which is most of them — could
              not be read in full anywhere in the app. */}
          <h1 className="break-words text-[20px] font-bold leading-tight tracking-tight text-foreground">
            {doc.display_name}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <Pill tone={doc.kind === "IMAGE_PDF" || doc.origin === "CAMERA" ? "accent" : "neutral"}>
              {label("documentKind", doc.kind)}
            </Pill>
            {doc.is_priority && <Pill tone="warning">Prioritario</Pill>}
            {currentVersion?.page_count ? <span>{currentVersion.page_count} pág.</span> : null}
          </div>
        </div>
      </div>

      {/* One row, ordered by how often each is actually used. Sharing beats
          downloading on a phone — the file is going to a client, a bank or a
          notary, not to this device — so it takes the filled button, and
          everything that is occasional lives behind the three dots instead of
          spilling onto a second row of equal-looking pills. */}
      <div className="mb-4 flex items-center gap-2">
        <Button
          size="sm"
          variant="ink"
          className="min-w-0 flex-1 rounded-full"
          onClick={() => setShareViaOpen(true)}
        >
          <Share2 className="size-4 shrink-0" strokeWidth={1.8} /> Compartir
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 rounded-full"
          onClick={downloadCurrent}
          disabled={!blobState.blob}
          aria-label="Descargar"
        >
          {blobState.loading && !blobState.blob ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" strokeWidth={1.8} />
          )}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className="rounded-full" aria-label="Más acciones">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-52">
            <DropdownMenuItem onClick={goEditor}>
              <Pencil className="size-4" /> Editar
            </DropdownMenuItem>
            {hasSourceImages && (
              <DropdownMenuItem onClick={openScannerReedit} disabled={scannerLoading}>
                <Camera className="size-4" /> {scannerLoading ? "Cargando…" : "Recortar"}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => setHistoryOpen(true)}>
              <History className="size-4" /> Versiones
            </DropdownMenuItem>
            <DropdownMenuItem onClick={togglePriority} disabled={updateMutation.isPending}>
              <Star className="size-4" />
              {doc.is_priority ? "Quitar prioridad" : "Marcar prioritario"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setShareLinkOpen(true)}>
              <LinkIcon className="size-4" /> Shortlink
            </DropdownMenuItem>
            {user?.role === "ADMIN" && (
              <DropdownMenuItem onClick={() => setAudienceShareOpen(true)}>
                <Users className="size-4" /> Compartir con audiencia
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={togglePinOffline} disabled={updateMutation.isPending}>
              {doc?.pin_offline ? (
                <>
                  <Wifi className="size-4" /> Quitar offline
                </>
              ) : (
                <>
                  <WifiOff className="size-4" /> Disponible sin conexión
                </>
              )}
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

      {/* What this belongs to, before the document itself.
          A contract is almost never opened to read it — it is opened to get to
          the flat or the person it concerns. Those links used to sit in a right
          rail, which on a phone is *below* a full-page PDF preview: reachable
          only by scrolling past the entire thing you were not trying to read. */}
      <section className="mb-4">
        <SectionLabel action="+ Vincular" onAction={() => setPickerOpen(true)}>
          Relacionado con
        </SectionLabel>
        <div className="mt-3">
          <AssignmentList documentId={doc.id} assignments={doc.assignments ?? []} />
        </div>
      </section>

      <div className="overflow-hidden rounded-xl bg-secondary/40 p-2">
        <DocumentPreview
          blob={blobState.blob}
          mimeType={currentVersion?.mime_type}
          loading={blobState.loading}
        />
      </div>

      {/* Collapsed. Every row here is a fact about the file rather than about
          the deal — the checksum, the mime type, the antivirus verdict — and
          they were taking the same vertical space as the links above. */}
      <details className="group mt-4 overflow-hidden rounded-xl bg-card">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-[14px] font-medium text-muted-foreground">
          <ChevronRight
            className="size-4 shrink-0 transition-transform group-open:rotate-90"
            strokeWidth={2}
          />
          Detalles del archivo
        </summary>
        <dl className="divide-y divide-border border-t border-border">
          <InfoRow label="Origen" value={doc.origin} />
          <InfoRow label="Creado" value={formatDateTime(doc.created_at)} />
          <InfoRow label="Actualizado" value={formatDateTime(doc.updated_at)} />
          {doc.last_opened_at && (
            <InfoRow label="Abierto" value={formatDateTime(doc.last_opened_at)} />
          )}
          {currentVersion && (
            <>
              <InfoRow label="Versión" value={`v${currentVersion.version_number}`} />
              <InfoRow
                label="Tamaño"
                value={`${(currentVersion.size_bytes / 1024).toFixed(0)} KB`}
              />
              <InfoRow label="MIME" value={currentVersion.mime_type} />
              <InfoRow label="SHA-256" value={currentVersion.sha256.slice(0, 16)} />
              <InfoRow label="Antivirus" value={currentVersion.scan_status} />
            </>
          )}
          {blobState.source && (
            <InfoRow label="Fuente" value={blobState.source === "cache" ? "caché local" : "red"} />
          )}
        </dl>
      </details>

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
      <DocumentSharePanel
        documentId={doc.id}
        initialCaps={(doc as unknown as { audience_caps?: Record<string, string[]> }).audience_caps}
        open={audienceShareOpen}
        onOpenChange={setAudienceShareOpen}
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
    <div className="flex items-baseline justify-between gap-3 px-4 py-2.5 text-[13px]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate text-right font-mono text-foreground">{value}</dd>
    </div>
  );
}

// Default export so the router can code-split this page with React.lazy.
export default DocumentDetailPage;
