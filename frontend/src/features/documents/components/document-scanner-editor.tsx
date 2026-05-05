import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  FlipHorizontal,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Sparkles,
  Type,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { detectCorners } from "../services/scanner/corner-detect";
import { decodeImage } from "../services/scanner/decode";
import { canvasToJpegBlob, applyFilter } from "../services/scanner/filters";
import {
  clampQuad,
  hitTest,
  insetRect,
  midSidePoints,
  moveCorner,
  moveSide,
} from "../services/scanner/geometry";
import { warpQuad } from "../services/scanner/perspective-warp";
import type { Corner, EditState, FilterMode, Quad, Side } from "../services/scanner/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceBlob: Blob;
  initialState?: EditState;
  onSave: (result: { processed: Blob; state: EditState; raw: Blob }) => void;
}

const HANDLE_RADIUS = 14;
const MAGNIFIER_SIZE = 140;
const MAGNIFIER_ZOOM = 2;
const MAGNIFIER_OFFSET_Y = -100;

type Drag =
  | { kind: "corner"; corner: Corner }
  | { kind: "side"; side: Side; last: { x: number; y: number } };

export function DocumentScannerEditor({
  open,
  onOpenChange,
  sourceBlob,
  initialState,
  onSave,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const magRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const bitmapRef = useRef<ImageBitmap | null>(null);
  const jpegRef = useRef<Blob | null>(null);
  const dragRef = useRef<Drag | null>(null);

  const [quad, setQuad] = useState<Quad | null>(initialState?.quad ?? null);
  const [filter, setFilter] = useState<FilterMode>(initialState?.filter ?? "none");
  const [autoDetected, setAutoDetected] = useState(initialState?.autoDetected ?? false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [magnifier, setMagnifier] = useState<{ x: number; y: number } | null>(null);
  const [layout, setLayout] = useState<{
    drawX: number;
    drawY: number;
    drawW: number;
    drawH: number;
    canvasW: number;
    canvasH: number;
  } | null>(null);

  // Decode + auto-detect on mount.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const decoded = await decodeImage(sourceBlob);
        if (cancelled) return;
        bitmapRef.current = decoded.bitmap;
        jpegRef.current = decoded.asJpegBlob;
        if (!initialState) {
          // No auto-detect on mount. User taps "Auto" to opt in, which loads
          // OpenCV on demand. Default is a manual editable rect.
          setQuad(insetRect(decoded.bitmap.width, decoded.bitmap.height));
          setAutoDetected(false);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error decodificando imagen");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, sourceBlob, initialState]);

  // Redraw on quad/layout changes.
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const bitmap = bitmapRef.current;
    if (!canvas || !container || !bitmap || !quad) return;

    const dpr = window.devicePixelRatio || 1;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    canvas.style.width = `${cw}px`;
    canvas.style.height = `${ch}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, cw, ch);

    const scale = Math.min(cw / bitmap.width, ch / bitmap.height);
    const drawW = bitmap.width * scale;
    const drawH = bitmap.height * scale;
    const drawX = (cw - drawW) / 2;
    const drawY = (ch - drawH) / 2;
    ctx.drawImage(bitmap, drawX, drawY, drawW, drawH);

    const toScreen = (p: { x: number; y: number }) => ({
      x: drawX + p.x * scale,
      y: drawY + p.y * scale,
    });
    const sQuad = quad.map(toScreen);
    const mids = midSidePoints(quad);
    const sMids = (Object.keys(mids) as Side[]).map((s) => ({ s, p: toScreen(mids[s]) }));

    // polygon
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(59,130,246,0.95)";
    ctx.fillStyle = "rgba(59,130,246,0.12)";
    ctx.beginPath();
    sQuad.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // mid-side handles
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.strokeStyle = "rgba(59,130,246,0.95)";
    for (const m of sMids) {
      ctx.beginPath();
      ctx.arc(m.p.x, m.p.y, HANDLE_RADIUS - 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // corner handles
    for (const p of sQuad) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, HANDLE_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    setLayout({ drawX, drawY, drawW, drawH, canvasW: cw, canvasH: ch });
  }, [quad]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => redraw();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open, redraw]);

  // Magnifier draw.
  useEffect(() => {
    const mag = magRef.current;
    const bitmap = bitmapRef.current;
    if (!mag || !bitmap || !magnifier || !layout) return;
    const ctx = mag.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    mag.width = MAGNIFIER_SIZE * dpr;
    mag.height = MAGNIFIER_SIZE * dpr;
    mag.style.width = `${MAGNIFIER_SIZE}px`;
    mag.style.height = `${MAGNIFIER_SIZE}px`;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, MAGNIFIER_SIZE, MAGNIFIER_SIZE);

    // map screen → image coordinates
    const scaleScreen = layout.drawW / bitmap.width;
    const imgX = (magnifier.x - layout.drawX) / scaleScreen;
    const imgY = (magnifier.y - layout.drawY) / scaleScreen;
    const srcSize = MAGNIFIER_SIZE / (MAGNIFIER_ZOOM * scaleScreen);
    const sx = imgX - srcSize / 2;
    const sy = imgY - srcSize / 2;

    ctx.save();
    ctx.beginPath();
    ctx.arc(MAGNIFIER_SIZE / 2, MAGNIFIER_SIZE / 2, MAGNIFIER_SIZE / 2 - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, MAGNIFIER_SIZE, MAGNIFIER_SIZE);
    ctx.drawImage(bitmap, sx, sy, srcSize, srcSize, 0, 0, MAGNIFIER_SIZE, MAGNIFIER_SIZE);
    // crosshair
    ctx.strokeStyle = "rgba(59,130,246,0.95)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(MAGNIFIER_SIZE / 2, 0);
    ctx.lineTo(MAGNIFIER_SIZE / 2, MAGNIFIER_SIZE);
    ctx.moveTo(0, MAGNIFIER_SIZE / 2);
    ctx.lineTo(MAGNIFIER_SIZE, MAGNIFIER_SIZE / 2);
    ctx.stroke();
    ctx.restore();
    // border
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(MAGNIFIER_SIZE / 2, MAGNIFIER_SIZE / 2, MAGNIFIER_SIZE / 2 - 2, 0, Math.PI * 2);
    ctx.stroke();
  }, [magnifier, layout]);

  const screenToImage = useCallback(
    (sx: number, sy: number): { x: number; y: number } | null => {
      const bitmap = bitmapRef.current;
      if (!bitmap || !layout) return null;
      const scale = layout.drawW / bitmap.width;
      return { x: (sx - layout.drawX) / scale, y: (sy - layout.drawY) / scale };
    },
    [layout],
  );

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!quad || !canvasRef.current) return;
    canvasRef.current.setPointerCapture(e.pointerId);
    const rect = canvasRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const img = screenToImage(sx, sy);
    if (!img) return;
    const bitmap = bitmapRef.current!;
    // threshold in image space ≈ 44 screen px
    const scale = layout!.drawW / bitmap.width;
    const threshold = 44 / scale;
    const result = hitTest(img, quad, threshold);
    if (result.kind === "corner" || result.kind === "zone") {
      dragRef.current = { kind: "corner", corner: result.corner! };
    } else {
      dragRef.current = { kind: "side", side: result.side!, last: img };
    }
    setMagnifier({ x: sx, y: sy });
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current || !canvasRef.current || !quad) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const img = screenToImage(sx, sy);
    if (!img) return;
    const bitmap = bitmapRef.current!;
    if (dragRef.current.kind === "corner") {
      const next = clampQuad(
        moveCorner(quad, dragRef.current.corner, img),
        bitmap.width,
        bitmap.height,
      );
      setQuad(next);
    } else {
      const last = dragRef.current.last;
      const delta = { x: img.x - last.x, y: img.y - last.y };
      const next = clampQuad(
        moveSide(quad, dragRef.current.side, delta),
        bitmap.width,
        bitmap.height,
      );
      dragRef.current.last = img;
      setQuad(next);
    }
    setMagnifier({ x: sx, y: sy });
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (canvasRef.current?.hasPointerCapture(e.pointerId)) {
      canvasRef.current.releasePointerCapture(e.pointerId);
    }
    dragRef.current = null;
    setMagnifier(null);
  };

  const reDetect = async () => {
    const bitmap = bitmapRef.current;
    if (!bitmap) return;
    setBusy(true);
    try {
      const det = await detectCorners(bitmap);
      setQuad(det.quad);
      setAutoDetected(det.autoDetected);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    const bitmap = bitmapRef.current;
    if (!bitmap) return;
    setQuad(insetRect(bitmap.width, bitmap.height));
    setAutoDetected(false);
  };

  const replaceBitmap = async (
    draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
    outW: number,
    outH: number,
  ) => {
    const bitmap = bitmapRef.current;
    if (!bitmap) return;
    setBusy(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      draw(ctx, bitmap.width, bitmap.height);
      const next = await createImageBitmap(canvas);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92),
      );
      bitmap.close?.();
      bitmapRef.current = next;
      if (blob) jpegRef.current = blob;
      setQuad(insetRect(next.width, next.height));
      setAutoDetected(false);
    } finally {
      setBusy(false);
    }
  };

  const rotate = (deg: 90 | -90 | 180) => {
    const bitmap = bitmapRef.current;
    if (!bitmap) return;
    const w = bitmap.width;
    const h = bitmap.height;
    const outW = deg === 180 ? w : h;
    const outH = deg === 180 ? h : w;
    void replaceBitmap(
      (ctx) => {
        ctx.translate(outW / 2, outH / 2);
        ctx.rotate((deg * Math.PI) / 180);
        ctx.drawImage(bitmap, -w / 2, -h / 2);
      },
      outW,
      outH,
    );
  };

  const flipH = () => {
    const bitmap = bitmapRef.current;
    if (!bitmap) return;
    void replaceBitmap(
      (ctx, w) => {
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(bitmap, 0, 0);
      },
      bitmap.width,
      bitmap.height,
    );
  };

  const cycleFilter = () => {
    setFilter((prev) => (prev === "none" ? "bw" : prev === "bw" ? "enhance" : "none"));
  };

  const apply = async () => {
    const bitmap = bitmapRef.current;
    const raw = jpegRef.current ?? sourceBlob;
    if (!bitmap || !quad) return;
    setBusy(true);
    try {
      const warped = await warpQuad(bitmap, quad);
      const filtered = await applyFilter(warped, filter);
      const processed = await canvasToJpegBlob(filtered, 0.85);
      const state: EditState = {
        quad,
        filter,
        autoDetected,
        sourceWidth: bitmap.width,
        sourceHeight: bitmap.height,
      };
      onSave({ processed, state, raw });
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error procesando imagen");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  const filterLabel = filter === "none" ? "Sin filtro" : filter === "bw" ? "B&N" : "Mejorar";

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background text-foreground">
      <div className="flex items-center justify-between border-b border-border/40 bg-card/40 px-4 py-3">
        <div className="text-sm font-medium">Recortar documento</div>
        <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
          <X className="size-5" />
        </Button>
      </div>

      <div ref={containerRef} className="relative flex-1 overflow-hidden touch-none select-none">
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="absolute inset-0"
        />
        {magnifier && (
          <canvas
            ref={magRef}
            className="pointer-events-none absolute"
            style={{
              left: magnifier.x - MAGNIFIER_SIZE / 2,
              top: magnifier.y + MAGNIFIER_OFFSET_Y - MAGNIFIER_SIZE / 2,
            }}
          />
        )}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 text-sm text-muted-foreground">
            Cargando…
          </div>
        )}
      </div>

      <div className="flex items-center justify-around gap-2 border-t border-border/40 bg-card/40 px-3 py-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={cycleFilter}
          disabled={busy || loading}
          className={cn("flex flex-col gap-0.5", filter !== "none" && "text-primary")}
        >
          {filter === "bw" ? <Type className="size-5" /> : <Sparkles className="size-5" />}
          <span className="text-[10px]">{filterLabel}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => rotate(-90)}
          disabled={busy || loading}
          className="flex flex-col gap-0.5"
        >
          <RotateCcw className="size-5" />
          <span className="text-[10px]">Rotar</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => rotate(90)}
          disabled={busy || loading}
          className="flex flex-col gap-0.5"
        >
          <RotateCw className="size-5" />
          <span className="text-[10px]">Rotar</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={flipH}
          disabled={busy || loading}
          className="flex flex-col gap-0.5"
        >
          <FlipHorizontal className="size-5" />
          <span className="text-[10px]">Voltear</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={reDetect}
          disabled={busy || loading}
          className="flex flex-col gap-0.5"
        >
          <RefreshCw className="size-5" />
          <span className="text-[10px]">Auto</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={reset}
          disabled={busy || loading}
          className="flex flex-col gap-0.5"
        >
          <span className="text-base leading-none">↺</span>
          <span className="text-[10px]">Reset</span>
        </Button>
        <Button size="lg" onClick={apply} disabled={busy || loading || !quad}>
          <Check className="size-5" /> Aplicar
        </Button>
      </div>
    </div>
  );
}
