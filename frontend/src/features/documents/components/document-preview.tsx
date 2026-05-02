import { useEffect, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { LoadingSpinner } from "@shared/components/loading-spinner/loading-spinner";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

interface Props {
  blob: Blob | null;
  loading?: boolean;
  maxPages?: number;
}

export function DocumentPreview({ blob, loading, maxPages = 25 }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);

  useEffect(() => {
    if (!blob) {
      setSrc(null);
      return;
    }
    const url = URL.createObjectURL(blob);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!src || !blob) return null;

  if (blob.type.startsWith("image/")) {
    return (
      <img src={src} alt="preview" className="mx-auto max-h-[80dvh] rounded-md object-contain" />
    );
  }

  if (blob.type === "application/pdf") {
    return (
      <Document
        file={src}
        onLoadSuccess={({ numPages }) => setPageCount(numPages)}
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
