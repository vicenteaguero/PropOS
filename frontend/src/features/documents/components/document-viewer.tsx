import { useCallback, useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Download, Minus, Plus, Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@shared/components/loading-spinner/loading-spinner";
import { useImmersive } from "@layouts/immersive";
import { useDismissOnBack } from "@shared/hooks/use-dismiss-on-back";
import { cn } from "@/lib/utils";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";

const MIN_SCALE = 1;
const MAX_SCALE = 6;

interface DocumentViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blob: Blob | null;
  mimeType?: string | null;
  title: string;
  loading?: boolean;
  onShare?: () => void;
  onDownload?: () => void;
}

/**
 * Reading mode: the document, the whole screen, and zoom that stays put.
 *
 * The inline preview renders pages at a fixed width with the page scrolling
 * behind them, so pinching zoomed the *browser* — chrome, nav bar and all —
 * and left the app at a random offset that only a reload would undo. Here the
 * gesture is handled on a `touch-action: none` surface and applied as a
 * transform, so the zoom belongs to the document and nothing outside this
 * element ever moves.
 */
export function DocumentViewer({
  open,
  onOpenChange,
  blob,
  mimeType,
  title,
  loading,
  onShare,
  onDownload,
}: DocumentViewerProps) {
  useImmersive(open);
  useDismissOnBack(open, () => onOpenChange(false));

  const [src, setSrc] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [failed, setFailed] = useState(false);
  const effectiveMime = (mimeType || blob?.type || "").toLowerCase();

  useEffect(() => {
    if (!blob || !open) {
      setSrc(null);
      return;
    }
    const typed =
      effectiveMime && blob.type !== effectiveMime
        ? new Blob([blob], { type: effectiveMime })
        : blob;
    const url = URL.createObjectURL(typed);
    setSrc(url);
    setFailed(false);
    return () => URL.revokeObjectURL(url);
  }, [blob, effectiveMime, open]);

  const zoom = useZoomPan(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onOpenChange(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  if (!open) return null;

  const isPdf = effectiveMime === "application/pdf";
  const isImage = effectiveMime.startsWith("image/");
  const zoomable = isPdf || isImage;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black">
      <div className="flex shrink-0 items-center gap-2 px-2 pt-[calc(var(--safe-top)+0.5rem)] pb-2">
        <Button
          size="icon"
          variant="ghost"
          className="size-11 shrink-0 rounded-full text-white hover:bg-white/10"
          onClick={() => onOpenChange(false)}
          aria-label="Cerrar"
        >
          <X className="size-5" strokeWidth={2} />
        </Button>
        <p className="min-w-0 flex-1 truncate text-[15px] font-semibold text-white">{title}</p>
        {zoomable && (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="size-11 rounded-full text-white hover:bg-white/10"
              onClick={zoom.out}
              aria-label="Alejar"
              disabled={zoom.scale <= MIN_SCALE}
            >
              <Minus className="size-5" strokeWidth={2} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-11 rounded-full text-white hover:bg-white/10"
              onClick={zoom.in}
              aria-label="Acercar"
              disabled={zoom.scale >= MAX_SCALE}
            >
              <Plus className="size-5" strokeWidth={2} />
            </Button>
          </div>
        )}
        {onShare && (
          <Button
            size="icon"
            variant="ghost"
            className="size-11 shrink-0 rounded-full text-white hover:bg-white/10"
            onClick={onShare}
            aria-label="Compartir"
          >
            <Share2 className="size-5" strokeWidth={1.9} />
          </Button>
        )}
        {onDownload && (
          <Button
            size="icon"
            variant="ghost"
            className="size-11 shrink-0 rounded-full text-white hover:bg-white/10"
            onClick={onDownload}
            aria-label="Descargar"
          >
            <Download className="size-5" strokeWidth={1.9} />
          </Button>
        )}
      </div>

      <div
        ref={zoom.ref}
        // `touch-action: none` is what keeps the pinch inside this element. With
        // the browser's default the gesture becomes a page zoom and the app is
        // left scaled and offset with no way back short of a reload.
        className={cn(
          "min-h-0 flex-1 overflow-auto overscroll-contain",
          zoomable && "touch-none select-none",
        )}
        onDoubleClick={zoom.toggle}
      >
        {loading || (!src && !failed) ? (
          <div className="flex h-full items-center justify-center">
            <LoadingSpinner />
          </div>
        ) : (
          <div
            className="origin-top-left"
            style={{
              transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})`,
              transition: zoom.animating ? "transform 160ms ease-out" : undefined,
            }}
          >
            {isImage && src && (
              <img src={src} alt={title} className="mx-auto block max-w-full" draggable={false} />
            )}
            {isPdf && src && !failed && (
              <Document
                file={src}
                onLoadSuccess={({ numPages }) => setPageCount(numPages)}
                onLoadError={() => setFailed(true)}
                onSourceError={() => setFailed(true)}
                loading={
                  <div className="flex h-[60dvh] items-center justify-center">
                    <LoadingSpinner />
                  </div>
                }
              >
                {Array.from({ length: pageCount }).map((_, i) => (
                  <div key={i} className="mb-2 flex justify-center">
                    <Page
                      pageNumber={i + 1}
                      width={Math.min(1200, window.innerWidth)}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                    />
                  </div>
                ))}
              </Document>
            )}
            {!zoomable && (
              <UnsupportedNotice onShare={onShare} onDownload={onDownload} mime={effectiveMime} />
            )}
            {failed && (
              <p className="p-8 text-center text-sm text-white/70">
                No se pudo mostrar el documento. Descárgalo para abrirlo.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function UnsupportedNotice({
  mime,
  onShare,
  onDownload,
}: {
  mime: string;
  onShare?: () => void;
  onDownload?: () => void;
}) {
  // Word files and anything else we cannot draw. Saying so plainly beats an
  // empty frame that looks like a failed load.
  const kind = mime.includes("wordprocessingml") ? "Word" : "este tipo de archivo";
  return (
    <div className="flex h-[70dvh] flex-col items-center justify-center gap-4 px-8 text-center">
      <p className="text-[15px] font-semibold text-white">No podemos mostrar {kind} acá</p>
      <p className="max-w-sm text-[14px] text-white/70">
        Ábrelo en otra app para verlo completo, o compártelo directamente.
      </p>
      <div className="flex gap-2">
        {onShare && (
          <Button variant="secondary" className="rounded-full" onClick={onShare}>
            <Share2 className="size-4" strokeWidth={1.9} /> Compartir
          </Button>
        )}
        {onDownload && (
          <Button variant="secondary" className="rounded-full" onClick={onDownload}>
            <Download className="size-4" strokeWidth={1.9} /> Descargar
          </Button>
        )}
      </div>
    </div>
  );
}

interface ZoomPan {
  ref: React.RefObject<HTMLDivElement | null>;
  scale: number;
  x: number;
  y: number;
  animating: boolean;
  in: () => void;
  out: () => void;
  toggle: () => void;
}

/**
 * Pinch, drag and double-tap, as a transform on one element.
 *
 * Pointer events rather than touch events so a trackpad pinch and a mouse drag
 * land in the same code path — the laptop is a first-class target here, not an
 * afterthought.
 */
function useZoomPan(active: boolean): ZoomPan {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [animating, setAnimating] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; scale: number } | null>(null);
  const pan = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const clamp = (next: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));

  const reset = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    if (!active) reset();
  }, [active, reset]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !active) return;

    const down = (e: PointerEvent) => {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()];
        if (a && b) {
          pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale };
          pan.current = null;
        }
      } else if (pointers.current.size === 1 && scale > 1) {
        pan.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
      }
    };

    const move = (e: PointerEvent) => {
      if (!pointers.current.has(e.pointerId)) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      setAnimating(false);
      if (pinch.current && pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()];
        if (a && b) {
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          setScale(clamp((pinch.current.scale * dist) / (pinch.current.dist || 1)));
        }
      } else if (pan.current) {
        setOffset({
          x: pan.current.ox + (e.clientX - pan.current.x),
          y: pan.current.oy + (e.clientY - pan.current.y),
        });
      }
    };

    const up = (e: PointerEvent) => {
      pointers.current.delete(e.pointerId);
      if (pointers.current.size < 2) pinch.current = null;
      if (pointers.current.size === 0) {
        pan.current = null;
        // Snapping back at 1x means a stray drag can never strand the document
        // off screen with no visible way to recover it.
        if (scale <= MIN_SCALE) {
          setAnimating(true);
          setOffset({ x: 0, y: 0 });
        }
      }
    };

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, [active, scale, offset.x, offset.y]);

  const step = (delta: number) => {
    setAnimating(true);
    setScale((s) => {
      const next = clamp(s + delta);
      if (next <= MIN_SCALE) setOffset({ x: 0, y: 0 });
      return next;
    });
  };

  return {
    ref,
    scale,
    x: offset.x,
    y: offset.y,
    animating,
    in: () => step(0.5),
    out: () => step(-0.5),
    toggle: () => {
      setAnimating(true);
      if (scale > 1) {
        setScale(1);
        setOffset({ x: 0, y: 0 });
      } else {
        setScale(2);
      }
    },
  };
}
