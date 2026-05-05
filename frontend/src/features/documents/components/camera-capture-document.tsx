import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Ban,
  Camera,
  Check,
  FlipHorizontal,
  FlipVertical,
  Plus,
  RotateCcw,
  RotateCw,
  Sparkles,
  Trash2,
  Type,
  X,
} from "lucide-react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { compressBlob } from "../services/image-compression";
import { imagesToPdf } from "../services/pdf-from-images";
import { decodeImage } from "../services/scanner/decode";
import { applyFilter, canvasToJpegBlob } from "../services/scanner/filters";
import {
  clampQuad,
  hitTest,
  insetRect,
  midSidePoints,
  moveCorner,
  moveSide,
} from "../services/scanner/geometry";
import { warpQuad } from "../services/scanner/perspective-warp";
import type { Corner, FilterMode, Quad, Side } from "../services/scanner/types";

export interface ShotEdit {
  quad: Quad;
  filter: FilterMode;
}

export interface SourceShot {
  raw: Blob;
  edit: ShotEdit;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPdfReady: (pdfBytes: Uint8Array, sources: SourceShot[]) => void;
  initialShots?: SourceShot[];
}

interface Shot {
  id: string;
  raw: Blob;
  bitmap: ImageBitmap | null;
  edit: ShotEdit | null;
}

type Mode = "capture" | "edit";

const HANDLE_RADIUS = 14;
const MAGNIFIER_SIZE = 140;
const MAGNIFIER_ZOOM = 2;

type Drag =
  | { kind: "corner"; corner: Corner }
  | { kind: "side"; side: Side; last: { x: number; y: number } };

export function CameraCaptureDocument({ open, onOpenChange, onPdfReady, initialShots }: Props) {
  // ---------- camera stream ----------
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [fallback, setFallback] = useState(false);

  // ---------- shots ----------
  const initialShotState = useMemo(
    () =>
      (initialShots ?? []).map((s) => ({
        id: crypto.randomUUID(),
        raw: s.raw,
        bitmap: null as ImageBitmap | null,
        edit: s.edit,
      })),
    [initialShots],
  );
  const [shots, setShots] = useState<Shot[]>(initialShotState);
  const [activeId, setActiveId] = useState<string | null>(
    initialShotState.length > 0 ? initialShotState[0]!.id : null,
  );
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<Mode>(initialShotState.length > 0 ? "edit" : "capture");

  // ---------- canvas / drag ----------
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const magRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const [magnifier, setMagnifier] = useState<{ x: number; y: number } | null>(null);
  const [layout, setLayout] = useState<{
    drawX: number;
    drawY: number;
    drawW: number;
    drawH: number;
    canvasW: number;
    canvasH: number;
  } | null>(null);

  const activeShot = useMemo(
    () => (activeId ? (shots.find((s) => s.id === activeId) ?? null) : null),
    [activeId, shots],
  );

  // ---------- thumbnail urls ----------
  const shotUrls = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of shots) map.set(s.id, URL.createObjectURL(s.raw));
    return map;
  }, [shots]);
  useEffect(() => {
    return () => shotUrls.forEach((u) => URL.revokeObjectURL(u));
  }, [shotUrls]);

  // ---------- camera stream lifecycle ----------
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!open) {
      stopStream();
      setShots([]);
      setActiveId(null);
      setFallback(false);
      setMode("capture");
      return;
    }
    if (mode !== "capture") {
      stopStream();
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (e) {
        if (cancelled) return;
        console.warn("camera unavailable, fallback to file input", e);
        setFallback(true);
      }
    })();
    return () => {
      cancelled = true;
      stopStream();
    };
  }, [open, mode, stopStream]);

  // ---------- decode active shot ----------
  useEffect(() => {
    if (mode !== "edit" || !activeShot || activeShot.bitmap) return;
    let cancelled = false;
    (async () => {
      try {
        const decoded = await decodeImage(activeShot.raw);
        if (cancelled) return;
        setShots((prev) =>
          prev.map((s) =>
            s.id === activeShot.id
              ? {
                  ...s,
                  bitmap: decoded.bitmap,
                  edit: s.edit ?? {
                    quad: insetRect(decoded.bitmap.width, decoded.bitmap.height),
                    filter: "none",
                  },
                }
              : s,
          ),
        );
      } catch (e) {
        if (cancelled) return;
        toast.error(e instanceof Error ? e.message : "Error decodificando imagen");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, activeShot]);

  // ---------- filtered preview cache ----------
  const previewRef = useRef<{ key: string; canvas: HTMLCanvasElement } | null>(null);
  const buildPreview = useCallback(async (bitmap: ImageBitmap, filter: FilterMode) => {
    const key = `${bitmap.width}x${bitmap.height}:${filter}`;
    if (previewRef.current?.key === key) return previewRef.current.canvas;
    const max = 900;
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const base = document.createElement("canvas");
    base.width = w;
    base.height = h;
    const bctx = base.getContext("2d");
    if (!bctx) throw new Error("2d ctx");
    bctx.drawImage(bitmap, 0, 0, w, h);
    const out = await applyFilter(base, filter);
    previewRef.current = { key, canvas: out };
    return out;
  }, []);

  // ---------- redraw ----------
  const redraw = useCallback(async () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const bitmap = activeShot?.bitmap;
    const edit = activeShot?.edit;
    if (!canvas || !container || !bitmap || !edit) return;

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
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, cw, ch);

    const scale = Math.min(cw / bitmap.width, ch / bitmap.height);
    const drawW = bitmap.width * scale;
    const drawH = bitmap.height * scale;
    const drawX = (cw - drawW) / 2;
    const drawY = (ch - drawH) / 2;

    const preview = await buildPreview(bitmap, edit.filter);
    ctx.drawImage(preview, drawX, drawY, drawW, drawH);

    const toScreen = (p: { x: number; y: number }) => ({
      x: drawX + p.x * scale,
      y: drawY + p.y * scale,
    });
    const sQuad = edit.quad.map(toScreen);
    const mids = midSidePoints(edit.quad);
    const sMids = (Object.keys(mids) as Side[]).map((s) => ({ s, p: toScreen(mids[s]) }));

    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(99,102,241,0.95)";
    ctx.fillStyle = "rgba(99,102,241,0.12)";
    ctx.beginPath();
    sQuad.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.strokeStyle = "rgba(99,102,241,0.95)";
    for (const m of sMids) {
      ctx.beginPath();
      ctx.arc(m.p.x, m.p.y, HANDLE_RADIUS - 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    for (const p of sQuad) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, HANDLE_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    setLayout({ drawX, drawY, drawW, drawH, canvasW: cw, canvasH: ch });
  }, [activeShot, buildPreview]);

  useEffect(() => {
    void redraw();
  }, [redraw]);

  useEffect(() => {
    if (mode !== "edit") return;
    const onResize = () => void redraw();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [mode, redraw]);

  // ---------- magnifier ----------
  useEffect(() => {
    const mag = magRef.current;
    const bitmap = activeShot?.bitmap;
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
    ctx.strokeStyle = "rgba(99,102,241,0.95)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(MAGNIFIER_SIZE / 2, 0);
    ctx.lineTo(MAGNIFIER_SIZE / 2, MAGNIFIER_SIZE);
    ctx.moveTo(0, MAGNIFIER_SIZE / 2);
    ctx.lineTo(MAGNIFIER_SIZE, MAGNIFIER_SIZE / 2);
    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(MAGNIFIER_SIZE / 2, MAGNIFIER_SIZE / 2, MAGNIFIER_SIZE / 2 - 2, 0, Math.PI * 2);
    ctx.stroke();
  }, [magnifier, layout, activeShot]);

  // ---------- pointer handlers ----------
  const screenToImage = useCallback(
    (sx: number, sy: number) => {
      const bitmap = activeShot?.bitmap;
      if (!bitmap || !layout) return null;
      const scale = layout.drawW / bitmap.width;
      return {
        x: (sx - layout.drawX) / scale,
        y: (sy - layout.drawY) / scale,
      };
    },
    [activeShot, layout],
  );

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || !activeShot?.edit) return;
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const img = screenToImage(sx, sy);
    if (!img) return;
    const hit = hitTest(img, activeShot.edit.quad, 24);
    if (hit.kind === "corner" && hit.corner) {
      dragRef.current = { kind: "corner", corner: hit.corner };
    } else if (hit.kind === "side" && hit.side) {
      dragRef.current = { kind: "side", side: hit.side, last: img };
    } else {
      return;
    }
    canvasRef.current?.setPointerCapture(e.pointerId);
    setMagnifier({ x: sx, y: sy });
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current || !activeShot?.bitmap || !activeShot.edit) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const img = screenToImage(sx, sy);
    if (!img) return;
    const bitmap = activeShot.bitmap;
    const id = activeShot.id;
    if (dragRef.current.kind === "corner") {
      const next = clampQuad(
        moveCorner(activeShot.edit.quad, dragRef.current.corner, img),
        bitmap.width,
        bitmap.height,
      );
      setShots((prev) =>
        prev.map((s) => (s.id === id ? { ...s, edit: { ...s.edit!, quad: next } } : s)),
      );
    } else {
      const last = dragRef.current.last;
      const delta = { x: img.x - last.x, y: img.y - last.y };
      const next = clampQuad(
        moveSide(activeShot.edit.quad, dragRef.current.side, delta),
        bitmap.width,
        bitmap.height,
      );
      dragRef.current.last = img;
      setShots((prev) =>
        prev.map((s) => (s.id === id ? { ...s, edit: { ...s.edit!, quad: next } } : s)),
      );
    }
    setMagnifier(magnifierPosition(sx, sy, layout));
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (canvasRef.current?.hasPointerCapture(e.pointerId)) {
      canvasRef.current.releasePointerCapture(e.pointerId);
    }
    dragRef.current = null;
    setMagnifier(null);
  };

  // ---------- shot ops ----------
  const captureShot = async () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92),
    );
    if (!blob) return;
    const id = crypto.randomUUID();
    setShots((prev) => [...prev, { id, raw: blob, bitmap: null, edit: null }]);
  };

  const handleFileFallback = async (files: FileList | null) => {
    if (!files) return;
    const created: Shot[] = [];
    for (const file of Array.from(files)) {
      created.push({ id: crypto.randomUUID(), raw: file, bitmap: null, edit: null });
    }
    setShots((prev) => [...prev, ...created]);
  };

  const removeShot = (id: string) => {
    setShots((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (activeId === id) {
        setActiveId(next.length > 0 ? next[0]!.id : null);
      }
      return next;
    });
  };

  const replaceBitmap = async (
    draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
    outW: number,
    outH: number,
    mapPoint: (p: { x: number; y: number }, w: number, h: number) => { x: number; y: number },
  ) => {
    if (!activeShot?.bitmap) return;
    setBusy(true);
    try {
      const oldBitmap = activeShot.bitmap;
      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      draw(ctx, oldBitmap.width, oldBitmap.height);
      const next = await createImageBitmap(canvas);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92),
      );
      const w = oldBitmap.width;
      const h = oldBitmap.height;
      oldBitmap.close?.();
      const id = activeShot.id;
      setShots((prev) =>
        prev.map((s) => {
          if (s.id !== id) return s;
          const oldQuad = s.edit?.quad;
          const newQuad = (
            oldQuad ? oldQuad.map((p) => mapPoint(p, w, h)) : insetRect(next.width, next.height)
          ) as Quad;
          return {
            ...s,
            raw: blob ?? s.raw,
            bitmap: next,
            edit: {
              ...(s.edit ?? { filter: "none" as FilterMode }),
              quad: newQuad,
              filter: s.edit?.filter ?? "none",
            },
          };
        }),
      );
      previewRef.current = null;
    } finally {
      setBusy(false);
    }
  };

  const rotate = (deg: 90 | -90 | 180) => {
    const bitmap = activeShot?.bitmap;
    if (!bitmap) return;
    const w = bitmap.width;
    const h = bitmap.height;
    const outW = deg === 180 ? w : h;
    const outH = deg === 180 ? h : w;
    const mapPoint = (p: { x: number; y: number }, sw: number, sh: number) => {
      if (deg === 90) return { x: sh - p.y, y: p.x };
      if (deg === -90) return { x: p.y, y: sw - p.x };
      return { x: sw - p.x, y: sh - p.y };
    };
    void replaceBitmap(
      (ctx) => {
        ctx.translate(outW / 2, outH / 2);
        ctx.rotate((deg * Math.PI) / 180);
        ctx.drawImage(bitmap, -w / 2, -h / 2);
      },
      outW,
      outH,
      mapPoint,
    );
  };

  const flipH = () => {
    const bitmap = activeShot?.bitmap;
    if (!bitmap) return;
    void replaceBitmap(
      (ctx, w) => {
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(bitmap, 0, 0);
      },
      bitmap.width,
      bitmap.height,
      (p, sw) => ({ x: sw - p.x, y: p.y }),
    );
  };

  const flipV = () => {
    const bitmap = activeShot?.bitmap;
    if (!bitmap) return;
    void replaceBitmap(
      (ctx, _w, h) => {
        ctx.translate(0, h);
        ctx.scale(1, -1);
        ctx.drawImage(bitmap, 0, 0);
      },
      bitmap.width,
      bitmap.height,
      (p, _sw, sh) => ({ x: p.x, y: sh - p.y }),
    );
  };

  const setFilter = (f: FilterMode) => {
    if (!activeShot?.edit) return;
    const id = activeShot.id;
    setShots((prev) =>
      prev.map((s) => (s.id === id ? { ...s, edit: { ...s.edit!, filter: f } } : s)),
    );
    previewRef.current = null;
  };

  const resetActive = () => {
    const bitmap = activeShot?.bitmap;
    if (!bitmap || !activeShot) return;
    const id = activeShot.id;
    setShots((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              edit: { quad: insetRect(bitmap.width, bitmap.height), filter: "none" },
            }
          : s,
      ),
    );
    previewRef.current = null;
  };

  // ---------- generate PDF ----------
  const finalize = async () => {
    if (shots.length === 0) {
      toast.error("Captura al menos una imagen");
      return;
    }
    setBusy(true);
    try {
      const baked: Blob[] = [];
      const sources: SourceShot[] = [];
      for (const s of shots) {
        let bitmap = s.bitmap;
        if (!bitmap) {
          const decoded = await decodeImage(s.raw);
          bitmap = decoded.bitmap;
        }
        const edit = s.edit ?? {
          quad: insetRect(bitmap.width, bitmap.height),
          filter: "none" as FilterMode,
        };
        const warped = await warpQuad(bitmap, edit.quad);
        const filtered = await applyFilter(warped, edit.filter);
        const processed = await canvasToJpegBlob(filtered, 0.85);
        const compressed = await compressBlob(processed, `shot-${Date.now()}.jpg`);
        baked.push(compressed);
        sources.push({ raw: s.raw, edit });
      }
      const pdf = await imagesToPdf(baked);
      onPdfReady(pdf, sources);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error generando PDF");
    } finally {
      setBusy(false);
    }
  };

  // ---------- close guard ----------
  const closeWithGuard = () => {
    if (shots.length > 0 && !confirm(`Descartar ${shots.length} captura(s) sin guardar?`)) {
      return;
    }
    onOpenChange(false);
  };

  // ---------- mode transition ----------
  const goEdit = () => {
    if (shots.length === 0) return;
    if (!activeId) setActiveId(shots[0]!.id);
    setMode("edit");
  };

  // ---------- dnd ----------
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setShots((prev) => {
      const from = prev.findIndex((s) => s.id === active.id);
      const to = prev.findIndex((s) => s.id === over.id);
      if (from < 0 || to < 0) return prev;
      return arrayMove(prev, from, to);
    });
  };

  if (!open) return null;

  // -------------------- CAPTURE MODE --------------------
  if (mode === "capture") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background text-foreground">
        <div className="flex items-center justify-between border-b border-border/40 bg-card/40 px-4 py-3">
          <div className="text-sm font-medium">Cámara · {shots.length} pág.</div>
          <Button variant="ghost" size="icon" onClick={closeWithGuard}>
            <X className="size-5" />
          </Button>
        </div>

        <div className="flex flex-1 items-center justify-center overflow-hidden bg-black">
          {fallback ? (
            <label className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-border/60 p-8 text-center text-foreground">
              <Camera className="size-10" strokeWidth={1.4} />
              <span className="text-sm">Cámara no disponible. Selecciona fotos.</span>
              <input
                type="file"
                accept="image/*,.heic,.heif"
                multiple
                onChange={(e) => handleFileFallback(e.target.files)}
                className="text-xs"
              />
            </label>
          ) : (
            <video
              ref={videoRef}
              playsInline
              muted
              className="max-h-full max-w-full object-contain"
            />
          )}
        </div>

        {shots.length > 0 && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={shots.map((s) => s.id)}
              strategy={horizontalListSortingStrategy}
            >
              <div className="flex gap-2 overflow-x-auto border-t border-border/40 bg-card/40 px-4 py-2">
                {shots.map((shot, i) => (
                  <SortableThumb
                    key={shot.id}
                    id={shot.id}
                    index={i}
                    url={shotUrls.get(shot.id) ?? ""}
                    isActive={false}
                    size="sm"
                    onTap={() => undefined}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-border/40 bg-card/40 px-6 py-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShots([])}
            disabled={shots.length === 0}
          >
            <Trash2 className="size-4" /> Limpiar
          </Button>
          {!fallback && (
            <Button
              size="lg"
              onClick={captureShot}
              className="size-16 rounded-full p-0"
              aria-label="Capturar"
            >
              <Camera className="size-7" />
            </Button>
          )}
          <Button
            size="sm"
            variant={shots.length === 0 ? "ghost" : "default"}
            onClick={goEdit}
            disabled={shots.length === 0}
          >
            Continuar ({shots.length})
          </Button>
        </div>
      </div>
    );
  }

  // -------------------- EDIT MODE --------------------
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background text-foreground md:flex-row">
      {/* Header (mobile) */}
      <div className="flex items-center justify-between border-b border-border/40 bg-card/40 px-4 py-3 md:hidden">
        <div className="text-sm font-medium">Editar · {shots.length} pág.</div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={resetActive}
            disabled={!activeShot?.bitmap}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            Restablecer
          </Button>
          <Button variant="ghost" size="icon" onClick={closeWithGuard}>
            <X className="size-5" />
          </Button>
        </div>
      </div>

      {/* Sidebar (desktop) / inline strip (mobile) */}
      <aside className="hidden md:flex md:w-72 md:flex-col md:border-r md:border-border/40 md:bg-card/30">
        <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={closeWithGuard}>
            <X className="size-5" />
          </Button>
          <div className="text-sm font-medium">Editar</div>
          <Button
            variant="ghost"
            size="sm"
            onClick={resetActive}
            disabled={!activeShot?.bitmap}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            Restablecer
          </Button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto p-4">
          <div>
            <div className="mb-2 text-xs font-medium text-muted-foreground">Filtros</div>
            <FilterCards
              value={activeShot?.edit?.filter ?? "none"}
              onChange={setFilter}
              disabled={busy || !activeShot?.bitmap}
              bitmap={activeShot?.bitmap ?? null}
            />
          </div>
          <div>
            <div className="mb-2 text-xs font-medium text-muted-foreground">Transformar</div>
            <TransformGroup
              onRotateLeft={() => rotate(-90)}
              onRotateRight={() => rotate(90)}
              onFlipH={flipH}
              onFlipV={flipV}
              disabled={busy || !activeShot?.bitmap}
            />
          </div>
        </div>

        <div className="mt-auto flex items-center gap-2 border-t border-border/40 p-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => activeShot && removeShot(activeShot.id)}
            disabled={!activeShot}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-4" /> Eliminar
          </Button>
          <Button
            size="sm"
            className="ml-auto"
            onClick={finalize}
            disabled={busy || shots.length === 0}
          >
            <Check className="size-4" /> Generar PDF
          </Button>
        </div>
      </aside>

      {/* Main column */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <div ref={containerRef} className="relative flex-1 touch-none select-none">
          {activeShot?.bitmap ? (
            <canvas
              ref={canvasRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              className="absolute inset-0"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              {activeShot ? "Cargando…" : "Selecciona una página"}
            </div>
          )}
          {magnifier && (
            <canvas
              ref={magRef}
              className="pointer-events-none absolute z-[70]"
              style={{
                left: clampMag(magnifier.x - MAGNIFIER_SIZE / 2, layout?.canvasW),
                top: magOffsetY(magnifier.y, layout),
              }}
            />
          )}
        </div>

        {/* Mobile filter cards row */}
        <div className="border-t border-border/40 bg-card/30 p-3 md:hidden">
          <FilterCards
            value={activeShot?.edit?.filter ?? "none"}
            onChange={setFilter}
            disabled={busy || !activeShot?.bitmap}
          />
        </div>

        {/* Mobile transform row */}
        <div className="flex items-center justify-center gap-2 border-t border-border/40 bg-card/30 px-3 py-2 md:hidden">
          <TransformGroup
            onRotateLeft={() => rotate(-90)}
            onRotateRight={() => rotate(90)}
            onFlipH={flipH}
            onFlipV={flipV}
            disabled={busy || !activeShot?.bitmap}
          />
        </div>

        {/* Thumbnails strip with "Tomar más" trailing tile */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={shots.map((s) => s.id)} strategy={horizontalListSortingStrategy}>
            <div className="flex gap-2 overflow-x-auto border-t border-border/40 bg-card/40 p-3">
              {shots.map((shot, i) => (
                <SortableThumb
                  key={shot.id}
                  id={shot.id}
                  index={i}
                  url={shotUrls.get(shot.id) ?? ""}
                  isActive={activeId === shot.id}
                  onTap={() => setActiveId(shot.id)}
                />
              ))}
              <button
                type="button"
                onClick={() => setMode("capture")}
                className="flex aspect-[3/4] w-[88px] shrink-0 flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-border/50 text-muted-foreground transition hover:border-primary hover:text-primary"
              >
                <div className="relative">
                  <Camera className="size-7" />
                  <Plus className="absolute -bottom-1 -right-1 size-3" />
                </div>
                <span className="text-[10px]">Tomar más</span>
              </button>
            </div>
          </SortableContext>
        </DndContext>

        {/* Mobile bottom action bar */}
        <div className="flex items-center justify-between gap-2 border-t border-border/40 bg-card/40 px-4 py-3 md:hidden">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => activeShot && removeShot(activeShot.id)}
            disabled={!activeShot}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-4" /> Eliminar
          </Button>
          <Button size="sm" onClick={finalize} disabled={busy || shots.length === 0}>
            <Check className="size-4" /> Generar PDF
          </Button>
        </div>
      </main>
    </div>
  );
}

// ============================================================================
// helpers
// ============================================================================

function magnifierPosition(
  sx: number,
  sy: number,
  _layout: {
    drawX: number;
    drawY: number;
    drawW: number;
    drawH: number;
    canvasW: number;
    canvasH: number;
  } | null,
) {
  return { x: sx, y: sy };
}

function magOffsetY(
  touchY: number,
  layout: {
    canvasH: number;
  } | null,
) {
  if (!layout) return touchY - MAGNIFIER_SIZE / 2 - 100;
  const above = touchY - 100 - MAGNIFIER_SIZE / 2;
  const below = touchY + 100 - MAGNIFIER_SIZE / 2;
  if (above < 8) return below;
  if (below + MAGNIFIER_SIZE > layout.canvasH - 8) return above;
  return above;
}

function clampMag(x: number, canvasW: number | undefined) {
  if (!canvasW) return x;
  return Math.max(8, Math.min(x, canvasW - MAGNIFIER_SIZE - 8));
}

interface SortableThumbProps {
  id: string;
  index: number;
  url: string;
  isActive: boolean;
  size?: "sm" | "md";
  onTap: () => void;
}

function SortableThumb({ id, index, url, isActive, size = "md", onTap }: SortableThumbProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  const w = size === "sm" ? "w-12" : "w-[88px]";
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "relative aspect-[3/4] shrink-0 cursor-grab touch-none overflow-hidden rounded-md ring-1 transition active:cursor-grabbing",
        w,
        isActive ? "ring-2 ring-primary" : "ring-border/40",
      )}
      onPointerUp={() => {
        if (!isDragging) onTap();
      }}
      role="button"
      tabIndex={0}
    >
      <img src={url} alt={`Página ${index + 1}`} className="h-full w-full object-cover" />
      <span className="absolute bottom-1 right-1 rounded bg-foreground/85 px-1 text-[9px] font-semibold text-background">
        {index + 1}
      </span>
    </div>
  );
}

interface FilterCardsProps {
  value: FilterMode;
  onChange: (m: FilterMode) => void;
  disabled?: boolean;
  bitmap?: ImageBitmap | null;
}

function FilterCards({ value, onChange, disabled, bitmap }: FilterCardsProps) {
  const items: { mode: FilterMode; label: string; Icon: typeof Ban }[] = [
    { mode: "none", label: "Sin filtro", Icon: Ban },
    { mode: "bw", label: "B&N", Icon: Type },
    { mode: "enhance", label: "Mejorar", Icon: Sparkles },
  ];
  const [previews, setPreviews] = useState<Record<FilterMode, string | null>>({
    none: null,
    bw: null,
    enhance: null,
  });

  useEffect(() => {
    if (!bitmap) {
      setPreviews({ none: null, bw: null, enhance: null });
      return;
    }
    let cancelled = false;
    const urls: string[] = [];
    (async () => {
      const max = 96;
      const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      const next: Record<FilterMode, string | null> = { none: null, bw: null, enhance: null };
      for (const m of ["none", "bw", "enhance"] as FilterMode[]) {
        const base = document.createElement("canvas");
        base.width = w;
        base.height = h;
        const bctx = base.getContext("2d");
        if (!bctx) continue;
        bctx.drawImage(bitmap, 0, 0, w, h);
        const out = await applyFilter(base, m);
        const blob = await new Promise<Blob | null>((res) =>
          out.toBlob((b) => res(b), "image/jpeg", 0.7),
        );
        if (!blob) continue;
        const url = URL.createObjectURL(blob);
        urls.push(url);
        next[m] = url;
      }
      if (!cancelled) setPreviews(next);
    })();
    return () => {
      cancelled = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [bitmap]);

  return (
    <div className="flex gap-2">
      {items.map(({ mode, label, Icon }) => (
        <button
          key={mode}
          type="button"
          disabled={disabled}
          onClick={() => onChange(mode)}
          className={cn(
            "flex flex-1 flex-col items-center gap-1 rounded-md border bg-background p-2 text-xs transition",
            value === mode
              ? "border-primary ring-2 ring-primary/40"
              : "border-border text-muted-foreground hover:text-foreground",
            disabled && "pointer-events-none opacity-50",
          )}
        >
          {previews[mode] ? (
            <img src={previews[mode]!} alt={label} className="h-12 w-12 rounded object-cover" />
          ) : (
            <Icon className="size-5" />
          )}
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

interface TransformGroupProps {
  onRotateLeft: () => void;
  onRotateRight: () => void;
  onFlipH: () => void;
  onFlipV: () => void;
  disabled?: boolean;
}

function TransformGroup({
  onRotateLeft,
  onRotateRight,
  onFlipH,
  onFlipV,
  disabled,
}: TransformGroupProps) {
  return (
    <div className="flex items-center gap-1 rounded-md border border-border/40 bg-background/40 p-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={onRotateLeft}
        disabled={disabled}
        aria-label="Rotar izquierda"
      >
        <RotateCcw className="size-5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onRotateRight}
        disabled={disabled}
        aria-label="Rotar derecha"
      >
        <RotateCw className="size-5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onFlipH}
        disabled={disabled}
        aria-label="Voltear horizontal"
      >
        <FlipHorizontal className="size-5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onFlipV}
        disabled={disabled}
        aria-label="Voltear vertical"
      >
        <FlipVertical className="size-5" />
      </Button>
    </div>
  );
}
