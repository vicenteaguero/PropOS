import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Ban,
  Camera,
  Check,
  FlipHorizontal,
  FlipVertical,
  Loader2,
  Palette,
  PenTool,
  Plus,
  RotateCcw,
  RotateCw,
  Sparkles,
  Spline,
  Trash2,
  Type,
  X,
  Zap,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ContactLite, PropertyLite } from "../types";
import { EntityCombobox } from "./entity-combobox";
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
import type { Corner, FilterMode, Point, Quad, Side } from "../services/scanner/types";

export type BezierControls = { T?: Point; R?: Point; B?: Point; L?: Point };

export interface ShotEdit {
  quad: Quad;
  filter: FilterMode;
  bezierControls?: BezierControls;
}

export interface SourceShot {
  raw: Blob;
  edit: ShotEdit;
}

export interface FinalizeMeta {
  name: string;
  propertyTitle?: string;
  contactName?: string;
  tag?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPdfReady: (
    pdfBytes: Uint8Array,
    sources: SourceShot[],
    meta: FinalizeMeta,
  ) => Promise<void> | void;
  initialShots?: SourceShot[];
  /** When true, the editor renders the inline finalize overlay (name + assignments).
   * When false, it skips the overlay and just emits the PDF (legacy behavior used
   * by the document detail re-edit flow which already has metadata). */
  showFinalizeOverlay?: boolean;
  /** Suggestions for the inline finalize combobox. Caller controls fetching. */
  propertySuggestions?: PropertyLite[];
  contactSuggestions?: ContactLite[];
  /** Forwarded query strings — caller refetches based on these. */
  onPropertyQueryChange?: (q: string) => void;
  onContactQueryChange?: (q: string) => void;
  /** Emitted when the user picks (or clears) an existing property in the
   * inline finalize overlay. Caller uses the id to narrow the contacts list
   * to those associated with the property. */
  onPropertySelect?: (property: PropertyLite | null) => void;
  loadingProperties?: boolean;
  loadingContacts?: boolean;
}

type FinalizeProgress = null | "pdf" | "uploading" | "saving";

const QUICK_TAGS = ["ID", "Contrato", "Boleta", "Otro"] as const;

interface Shot {
  id: string;
  raw: Blob;
  bitmap: ImageBitmap | null;
  edit: ShotEdit | null;
}

type Mode = "capture" | "edit";

const HANDLE_RADIUS = 14;
const MAGNIFIER_SIZE = 140;
const MAGNIFIER_ZOOM = 1.5;
const HD_STORAGE_KEY = "propos:scanner-hd";

type ScanMode = "document" | "id" | "photo";

type Drag =
  | { kind: "corner"; corner: Corner }
  | { kind: "side"; side: Side; last: { x: number; y: number } };

export function CameraCaptureDocument({
  open,
  onOpenChange,
  onPdfReady,
  initialShots,
  showFinalizeOverlay = true,
  propertySuggestions = [],
  contactSuggestions = [],
  onPropertyQueryChange,
  onContactQueryChange,
  onPropertySelect,
  loadingProperties,
  loadingContacts,
}: Props) {
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
  const [curveMode, setCurveMode] = useState(false);
  const [scanMode, setScanMode] = useState<ScanMode>("document");
  const [hdEnabled, setHdEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage?.getItem(HD_STORAGE_KEY) === "1";
  });
  const toggleHd = useCallback(() => {
    setHdEnabled((v) => {
      const next = !v;
      try {
        window.localStorage?.setItem(HD_STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* no-op */
      }
      return next;
    });
  }, []);

  // ---------- finalize overlay state ----------
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<FinalizeProgress>(null);
  const defaultDocName = useMemo(() => `Escaneo ${new Date().toLocaleDateString("es-CL")}`, []);
  const [docName, setDocName] = useState(defaultDocName);
  const [docPropertyTitle, setDocPropertyTitle] = useState("");
  const [docSelectedProperty, setDocSelectedProperty] = useState<PropertyLite | null>(null);
  const [docContactName, setDocContactName] = useState("");
  const [docTag, setDocTag] = useState<string | undefined>(undefined);

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
      setFinalizeOpen(false);
      setSubmitting(false);
      setProgress(null);
      setDocName(defaultDocName);
      setDocPropertyTitle("");
      setDocContactName("");
      setDocTag(undefined);
      setScanMode("document");
      return;
    }
    if (mode !== "capture") {
      stopStream();
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        // Push the back camera to its native resolution. iPhone main lens is
        // 4032x3024 (12MP) — asking for that gets us full quality when HD is
        // on. Standard mode caps at 1920x1080 to keep memory in check on older
        // devices. `advanced` constraint is a hint Safari/Chrome will satisfy
        // best-effort and silently lower to native max if unsupported.
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: hdEnabled ? 4032 : 1920 },
            height: { ideal: hdEnabled ? 3024 : 1080 },
            advanced: hdEnabled ? [{ width: { min: 2560 }, height: { min: 1440 } }] : undefined,
          },
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
  }, [open, mode, stopStream, hdEnabled]);

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
                    filter: scanMode === "id" ? "magic" : "none",
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
  // Key includes shotId so two shots with the same dimensions don't share a
  // stale canvas. Without this, switching shots would briefly show the wrong
  // image while the new preview built.
  const previewRef = useRef<{ key: string; canvas: HTMLCanvasElement } | null>(null);
  const buildPreview = useCallback(
    async (shotId: string, bitmap: ImageBitmap, filter: FilterMode) => {
      const key = `${shotId}:${bitmap.width}x${bitmap.height}:${filter}`;
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
    },
    [],
  );

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

    const preview = await buildPreview(activeShot!.id, bitmap, edit.filter);
    ctx.drawImage(preview, drawX, drawY, drawW, drawH);

    const toScreen = (p: { x: number; y: number }) => ({
      x: drawX + p.x * scale,
      y: drawY + p.y * scale,
    });
    const sQuad = edit.quad.map(toScreen);
    const mids = midSidePoints(edit.quad);
    const bez = edit.bezierControls;
    // Display handle for a side: bezier midpoint when control set, else side midpoint.
    const sideHandlePoint = (s: Side): Point => {
      const ctrl = bez?.[s];
      if (!ctrl) return mids[s];
      const [a, b] = sideEndpoints(edit.quad, s);
      // Quadratic bezier at t=0.5: 0.25 a + 0.5 ctrl + 0.25 b.
      return {
        x: 0.25 * a.x + 0.5 * ctrl.x + 0.25 * b.x,
        y: 0.25 * a.y + 0.5 * ctrl.y + 0.25 * b.y,
      };
    };
    const sMids = (Object.keys(mids) as Side[]).map((s) => ({
      s,
      p: toScreen(sideHandlePoint(s)),
    }));

    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(99,102,241,0.95)";
    ctx.fillStyle = "rgba(99,102,241,0.12)";
    ctx.beginPath();
    const [TL, TR, BR, BL] = sQuad;
    const sCtrl = (s: Side) => (bez?.[s] ? toScreen(bez[s]!) : null);
    ctx.moveTo(TL!.x, TL!.y);
    const cT = sCtrl("T");
    if (cT) ctx.quadraticCurveTo(cT.x, cT.y, TR!.x, TR!.y);
    else ctx.lineTo(TR!.x, TR!.y);
    const cR = sCtrl("R");
    if (cR) ctx.quadraticCurveTo(cR.x, cR.y, BR!.x, BR!.y);
    else ctx.lineTo(BR!.x, BR!.y);
    const cB = sCtrl("B");
    if (cB) ctx.quadraticCurveTo(cB.x, cB.y, BL!.x, BL!.y);
    else ctx.lineTo(BL!.x, BL!.y);
    const cL = sCtrl("L");
    if (cL) ctx.quadraticCurveTo(cL.x, cL.y, TL!.x, TL!.y);
    else ctx.lineTo(TL!.x, TL!.y);
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
    // After rotate, bitmap dims swap but `layout` is still from the prior
    // render. Skip this frame so the magnifier doesn't sample with stale
    // coordinates — redraw will run next tick and the next pointer move
    // re-renders the lens correctly.
    const layoutAspect = layout.drawW / layout.drawH;
    const bitmapAspect = bitmap.width / bitmap.height;
    if (Math.abs(layoutAspect - bitmapAspect) > 0.05) return;
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
    } else if (curveMode) {
      // Bezier mode: drag updates the control point for this side.
      const side = dragRef.current.side;
      const cx = Math.max(0, Math.min(bitmap.width, img.x));
      const cy = Math.max(0, Math.min(bitmap.height, img.y));
      dragRef.current.last = img;
      setShots((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                edit: {
                  ...s.edit!,
                  bezierControls: {
                    ...(s.edit?.bezierControls ?? {}),
                    [side]: { x: cx, y: cy },
                  },
                },
              }
            : s,
        ),
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
      canvas.toBlob(resolve, "image/jpeg", hdEnabled ? 0.95 : 0.92),
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
          const oldCtrls = s.edit?.bezierControls;
          const newCtrls: BezierControls | undefined = oldCtrls
            ? (Object.fromEntries(
                (Object.keys(oldCtrls) as Side[]).flatMap((k) => {
                  const p = oldCtrls[k];
                  return p ? [[k, mapPoint(p, w, h)]] : [];
                }),
              ) as BezierControls)
            : undefined;
          return {
            ...s,
            raw: blob ?? s.raw,
            bitmap: next,
            edit: {
              ...(s.edit ?? { filter: "none" as FilterMode }),
              quad: newQuad,
              filter: s.edit?.filter ?? "none",
              bezierControls: newCtrls,
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
              edit: {
                quad: insetRect(bitmap.width, bitmap.height),
                filter: "none",
                bezierControls: undefined,
              },
            }
          : s,
      ),
    );
    previewRef.current = null;
  };

  // ---------- generate PDF ----------
  // When the inline overlay is enabled, "Generar PDF" first opens the finalize
  // overlay so the user can name the doc + pick assignments without the modal
  // flashing closed. When disabled (re-edit flow), keep legacy behavior: bake
  // PDF immediately and let the caller close the modal.
  const handleGeneratePdfClick = () => {
    if (shots.length === 0) {
      toast.error("Captura al menos una imagen");
      return;
    }
    if (showFinalizeOverlay) {
      setFinalizeOpen(true);
      return;
    }
    void runFinalize();
  };

  const runFinalize = async (meta?: FinalizeMeta) => {
    if (shots.length === 0) {
      toast.error("Captura al menos una imagen");
      return;
    }
    setBusy(true);
    setSubmitting(true);
    setProgress("pdf");
    const isId = scanMode === "id";
    const jpegQuality = isId ? 0.95 : 0.92;
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
        const warped = await warpQuad(bitmap, edit.quad, edit.bezierControls, {
          forceLandscape: isId,
        });
        const filtered = await applyFilter(warped, edit.filter);
        const processed = await canvasToJpegBlob(filtered, jpegQuality);
        const compressed = await compressBlob(processed, `shot-${Date.now()}.jpg`);
        baked.push(compressed);
        sources.push({ raw: s.raw, edit });
      }
      const pdf = await imagesToPdf(baked, { mode: isId ? "id" : "document" });
      setProgress("uploading");
      const finalMeta: FinalizeMeta = meta ?? {
        name: docName.trim() || defaultDocName,
      };
      if (isId && !finalMeta.tag) finalMeta.tag = "ID";
      await onPdfReady(pdf, sources, finalMeta);
      setProgress("saving");
      // Caller closes the modal on success. If they didn't, clear submitting
      // so the editor returns to interactive state.
      setSubmitting(false);
      setProgress(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error generando PDF");
      setProgress(null);
      setSubmitting(false);
    } finally {
      setBusy(false);
    }
  };

  const submitFinalize = () => {
    const meta: FinalizeMeta = {
      name: docName.trim() || defaultDocName,
      propertyTitle: docPropertyTitle.trim() || undefined,
      contactName: docContactName.trim() || undefined,
      tag: docTag,
    };
    void runFinalize(meta);
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
    const idHint = shots.length === 0 ? "Frente" : shots.length === 1 ? "Reverso" : "Listo";
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background text-foreground">
        <div className="flex items-center justify-between border-b border-border/40 bg-card/40 px-4 py-3">
          <div className="text-sm font-medium">Cámara · {shots.length} pág.</div>
          <Button variant="ghost" size="icon" onClick={closeWithGuard}>
            <X className="size-5" />
          </Button>
        </div>

        {/* Scan mode chip row */}
        <div className="flex items-center justify-center gap-2 border-b border-border/40 bg-card/30 px-3 py-2">
          {(
            [
              { key: "document", label: "Documento" },
              { key: "id", label: "Carnet" },
              { key: "photo", label: "Foto" },
            ] as { key: ScanMode; label: string }[]
          ).map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setScanMode(c.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition",
                scanMode === c.key
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black">
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
          {scanMode === "id" && !fallback && (
            <>
              {/* ID-1 aspect 85.60/53.98 = 1.586. Use a real aspect-locked div
                  centered over the container: max width 80vw / 60vh of the
                  visible viewport, then aspect-ratio CSS preserves the shape
                  on every screen size + camera resolution. */}
              <div
                className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                style={{
                  aspectRatio: "1.586 / 1",
                  width: "min(80%, calc(60% * 1.586))",
                }}
              >
                <div className="h-full w-full rounded-xl border-[3px] border-dashed border-primary/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
                <div className="absolute -bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-background/85 px-3 py-1 text-xs font-medium text-foreground backdrop-blur-sm">
                  {idHint}
                </div>
              </div>
            </>
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

        <div className="flex items-center justify-between gap-2 border-t border-border/40 bg-card/40 px-4 py-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShots([])}
              disabled={shots.length === 0}
            >
              <Trash2 className="size-4" /> Limpiar
            </Button>
            <button
              type="button"
              onClick={toggleHd}
              aria-pressed={hdEnabled}
              className={cn(
                "flex h-9 items-center gap-1 rounded-full border px-3 text-xs font-medium transition",
                hdEnabled
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              <Zap className="size-3.5" />
              HD
              {hdEnabled && <Check className="size-3" />}
            </button>
          </div>
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
  const progressLabel: Record<NonNullable<FinalizeProgress>, string> = {
    pdf: "Generando PDF…",
    uploading: "Subiendo…",
    saving: "Guardando…",
  };

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
              curveActive={curveMode}
              onToggleCurve={() => setCurveMode((v) => !v)}
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
            onClick={handleGeneratePdfClick}
            disabled={busy || submitting || shots.length === 0}
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}{" "}
            Generar PDF
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
            <>
              <canvas
                ref={magRef}
                className="pointer-events-none absolute z-[70]"
                style={{
                  left: clampMag(magnifier.x - MAGNIFIER_SIZE / 2, layout?.canvasW),
                  top: magOffsetY(magnifier.y, layout),
                }}
              />
              <div
                className="pointer-events-none absolute z-[60] size-3.5 rounded-full border-2 border-primary bg-transparent"
                style={{
                  left: magnifier.x - 7,
                  top: magnifier.y - 7,
                }}
              />
            </>
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
            curveActive={curveMode}
            onToggleCurve={() => setCurveMode((v) => !v)}
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
          <Button
            size="sm"
            onClick={handleGeneratePdfClick}
            disabled={busy || submitting || shots.length === 0}
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}{" "}
            Generar PDF
          </Button>
        </div>
      </main>

      {finalizeOpen && (
        <div className="absolute inset-0 z-[80] flex items-center justify-center bg-background/85 backdrop-blur-sm">
          <div className="relative w-full max-w-md space-y-4 overflow-hidden rounded-lg border border-border/60 bg-card p-5 shadow-xl">
            {submitting && (
              <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 overflow-hidden bg-primary/15">
                <div className="anita-progress-bar h-full w-1/3 bg-primary" />
              </div>
            )}
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Guardar documento</h2>
              {!submitting && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setFinalizeOpen(false)}
                  aria-label="Cerrar"
                >
                  <X className="size-5" />
                </Button>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nombre</Label>
              <Input
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Propiedad</Label>
              <EntityCombobox<PropertyLite>
                value={docPropertyTitle}
                onChange={(text) => {
                  setDocPropertyTitle(text);
                  onPropertyQueryChange?.(text);
                  if (docSelectedProperty && text.trim() !== docSelectedProperty.title.trim()) {
                    setDocSelectedProperty(null);
                    onPropertySelect?.(null);
                  }
                }}
                onSelect={(p) => {
                  setDocSelectedProperty(p);
                  onPropertySelect?.(p);
                }}
                items={propertySuggestions}
                getLabel={(p) => p.title}
                getKey={(p) => p.id}
                loading={loadingProperties}
                placeholder="Av. Reñaca 115"
                emptyText="Sin propiedades"
                onAddNew={(text) => {
                  setDocPropertyTitle(text);
                  setDocSelectedProperty(null);
                  onPropertySelect?.(null);
                }}
                disabled={submitting}
                ariaLabel="Seleccionar propiedad"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Contacto</Label>
              <EntityCombobox<ContactLite>
                value={docContactName}
                onChange={(text) => {
                  setDocContactName(text);
                  onContactQueryChange?.(text);
                }}
                onSelect={() => undefined}
                items={contactSuggestions}
                getLabel={(c) => c.full_name}
                getKey={(c) => c.id}
                loading={loadingContacts}
                placeholder="Jaime Pérez"
                emptyText="Sin contactos"
                onAddNew={(text) => setDocContactName(text)}
                disabled={submitting}
                ariaLabel="Seleccionar contacto"
              />
              {docSelectedProperty && (
                <p className="text-[11px] text-muted-foreground">
                  Filtrado por {docSelectedProperty.title}
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
                    disabled={submitting}
                    onClick={() => setDocTag(docTag === t ? undefined : t)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs transition",
                      docTag === t
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground",
                      submitting && "pointer-events-none opacity-50",
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFinalizeOpen(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button size="sm" onClick={submitFinalize} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />{" "}
                    {progress ? progressLabel[progress] : "Procesando…"}
                  </>
                ) : (
                  <>
                    <Check className="size-4" /> Crear documento
                  </>
                )}
              </Button>
            </div>
            {progress && (
              <p className="text-center text-xs text-muted-foreground">{progressLabel[progress]}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// helpers
// ============================================================================

function sideEndpoints(quad: Quad, side: Side): [Point, Point] {
  const [TL, TR, BR, BL] = quad;
  switch (side) {
    case "T":
      return [TL, TR];
    case "R":
      return [TR, BR];
    case "B":
      return [BR, BL];
    case "L":
      return [BL, TL];
  }
}

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
  if (!layout) return touchY - MAGNIFIER_SIZE / 2 - 160;
  const above = touchY - 160 - MAGNIFIER_SIZE / 2;
  const below = touchY + 160 - MAGNIFIER_SIZE / 2;
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

const FILTER_CARDS: { mode: FilterMode; label: string; Icon: typeof Ban }[] = [
  { mode: "none", label: "Sin filtro", Icon: Ban },
  { mode: "magic", label: "Mágico", Icon: Sparkles },
  { mode: "color", label: "Color", Icon: Palette },
  { mode: "bw", label: "B&N", Icon: Type },
  { mode: "ink", label: "Tinta", Icon: PenTool },
];

function FilterCards({ value, onChange, disabled, bitmap }: FilterCardsProps) {
  const [previews, setPreviews] = useState<Record<string, string | null>>({});
  // Treat legacy "enhance" as "magic" for selection state.
  const selected: FilterMode = value === "enhance" ? "magic" : value;

  useEffect(() => {
    if (!bitmap) {
      setPreviews({});
      return;
    }
    let cancelled = false;
    const urls: string[] = [];
    (async () => {
      const max = 96;
      const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      const next: Record<string, string | null> = {};
      for (const item of FILTER_CARDS) {
        const m = item.mode;
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
    <div className="flex gap-2 overflow-x-auto">
      {FILTER_CARDS.map(({ mode, label, Icon }) => (
        <button
          key={mode}
          type="button"
          disabled={disabled}
          onClick={() => onChange(mode)}
          className={cn(
            "flex flex-1 min-w-[64px] flex-col items-center gap-1 rounded-md border bg-background p-2 text-xs transition",
            selected === mode
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
  curveActive: boolean;
  onToggleCurve: () => void;
  disabled?: boolean;
}

function TransformGroup({
  onRotateLeft,
  onRotateRight,
  onFlipH,
  onFlipV,
  curveActive,
  onToggleCurve,
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
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleCurve}
        disabled={disabled}
        aria-label="Curva"
        aria-pressed={curveActive}
        className={cn(curveActive && "bg-primary/15 text-primary hover:bg-primary/25")}
      >
        <Spline className="size-5" />
      </Button>
    </div>
  );
}
