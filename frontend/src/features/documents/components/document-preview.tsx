import { useEffect, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { LoadingSpinner } from "@shared/components/loading-spinner/loading-spinner";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";

interface Props {
  blob: Blob | null;
  mimeType?: string | null;
  loading?: boolean;
  maxPages?: number;
}

export function DocumentPreview({ blob, mimeType, loading, maxPages = 25 }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pdfError, setPdfError] = useState<Error | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Prefer the explicit mime from the version row; fall back to blob.type.
  const effectiveMime = (mimeType || blob?.type || "").toLowerCase();

  useEffect(() => {
    if (!blob) {
      setSrc(null);
      return;
    }
    // Re-wrap blob with correct mime so <img> / browser viewer pick the right handler.
    const typed =
      effectiveMime && blob.type !== effectiveMime
        ? new Blob([blob], { type: effectiveMime })
        : blob;
    const url = URL.createObjectURL(typed);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [blob, effectiveMime]);

  useEffect(() => {
    setPdfError(null);
    setPageCount(0);
  }, [src, reloadKey]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!src || !blob) return null;

  if (effectiveMime.startsWith("image/")) {
    return (
      <img src={src} alt="preview" className="mx-auto max-h-[80dvh] rounded-md object-contain" />
    );
  }

  if (effectiveMime === "application/pdf") {
    if (pdfError) {
      return (
        <div className="rounded-md border border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
          <p className="mb-3">No se pudo cargar el PDF</p>
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="rounded-md border border-border bg-background px-3 py-1 text-xs hover:bg-muted"
          >
            Reintentar
          </button>
        </div>
      );
    }
    return (
      <Document
        key={reloadKey}
        file={src}
        onLoadSuccess={({ numPages }) => setPageCount(numPages)}
        onLoadError={(err) => {
          console.error("[pdfjs]", err);
          setPdfError(err);
        }}
        onSourceError={(err) => {
          console.error("[pdfjs]", err);
          setPdfError(err);
        }}
        loading={
          <div className="flex h-64 items-center justify-center">
            <LoadingSpinner />
          </div>
        }
      >
        {Array.from({ length: Math.min(pageCount, maxPages) }).map((_, i) => (
          <div key={i} className="mb-3 flex justify-center">
            <Page pageNumber={i + 1} width={Math.min(900, window.innerWidth - 40)} />
          </div>
        ))}
        {pageCount > maxPages && (
          <p className="py-4 text-center text-xs text-muted-foreground">
            Se muestran {maxPages} de {pageCount} páginas. Descarga para ver completo.
          </p>
        )}
      </Document>
    );
  }

  return (
    <div className="rounded-md border border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
      Vista previa no disponible para este tipo. Descarga para abrir.
    </div>
  );
}
