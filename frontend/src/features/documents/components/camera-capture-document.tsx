import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Check, Edit3, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { compressBlob } from "../services/image-compression";
import { imagesToPdf } from "../services/pdf-from-images";
import type { EditState } from "../services/scanner/types";
import { DocumentScannerEditor } from "./document-scanner-editor";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPdfReady: (pdfBytes: Uint8Array) => void;
}

interface Shot {
  id: string;
  blob: Blob;
  raw: Blob;
  state?: EditState;
}

type Mode = "capture" | "review";

export function CameraCaptureDocument({ open, onOpenChange, onPdfReady }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [busy, setBusy] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [mode, setMode] = useState<Mode>("capture");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{
    id?: string;
    sourceBlob: Blob;
    state?: EditState;
  } | null>(null);

  const shotUrls = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of shots) map.set(s.id, URL.createObjectURL(s.blob));
    return map;
  }, [shots]);
  useEffect(() => {
    return () => shotUrls.forEach((u) => URL.revokeObjectURL(u));
  }, [shotUrls]);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (e) {
      console.warn("camera unavailable, fallback to file input", e);
      setFallback(true);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      stopStream();
      setShots([]);
      setActiveId(null);
      setFallback(false);
      setEditing(null);
      setMode("capture");
      return;
    }
    if (mode === "capture") {
      void startStream();
    } else {
      stopStream();
    }
    return () => stopStream();
  }, [open, mode, startStream, stopStream]);

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
    setShots((prev) => [...prev, { id: crypto.randomUUID(), blob, raw: blob }]);
  };

  const handleFileFallback = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      setShots((prev) => [...prev, { id: crypto.randomUUID(), blob: file, raw: file }]);
    }
  };

  const onEditorSave = async ({
    processed,
    state,
    raw,
  }: {
    processed: Blob;
    state: EditState;
    raw: Blob;
  }) => {
    const compressed = await compressBlob(processed, `shot-${Date.now()}.jpg`);
    if (editing?.id) {
      const id = editing.id;
      setShots((prev) =>
        prev.map((s) => (s.id === id ? { ...s, blob: compressed, state, raw } : s)),
      );
    } else {
      setShots((prev) => [...prev, { id: crypto.randomUUID(), blob: compressed, raw, state }]);
    }
    setEditing(null);
  };

  const removeShot = (id: string) => {
    setShots((prev) => prev.filter((s) => s.id !== id));
    if (activeId === id) setActiveId(null);
  };

  const editShot = (id: string) => {
    const shot = shots.find((s) => s.id === id);
    if (!shot) return;
    setEditing({ id, sourceBlob: shot.raw, state: shot.state });
  };

  const closeWithGuard = () => {
    if (shots.length > 0 && !confirm(`Descartar ${shots.length} captura(s) sin guardar?`)) {
      return;
    }
    onOpenChange(false);
  };

  const finalize = async () => {
    if (shots.length === 0) {
      toast.error("Captura al menos una imagen");
      return;
    }
    setBusy(true);
    try {
      const pdf = await imagesToPdf(shots.map((s) => s.blob));
      onPdfReady(pdf);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error generando PDF");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  const activeShot = activeId ? shots.find((s) => s.id === activeId) : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background text-foreground">
      <div className="flex items-center justify-between border-b border-border/40 bg-card/40 px-4 py-3">
        <div className="text-sm font-medium">
          {mode === "capture" ? `Cámara · ${shots.length} pág.` : `Revisar · ${shots.length} pág.`}
        </div>
        <Button variant="ghost" size="icon" onClick={closeWithGuard}>
          <X className="size-5" />
        </Button>
      </div>

      {mode === "capture" && (
        <>
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
            <div className="flex items-center gap-2 overflow-x-auto border-t border-border/40 bg-card/40 px-4 py-2">
              {shots.map((shot, i) => (
                <div key={shot.id} className="relative shrink-0">
                  <img
                    src={shotUrls.get(shot.id)}
                    alt={`Página ${i + 1}`}
                    className="h-16 w-12 rounded object-cover ring-1 ring-border/40"
                  />
                  <span className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                    {i + 1}
                  </span>
                </div>
              ))}
            </div>
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
              onClick={() => setMode("review")}
              disabled={shots.length === 0}
            >
              Revisar ({shots.length})
            </Button>
          </div>
        </>
      )}

      {mode === "review" && (
        <>
          <div className="flex flex-1 items-center justify-center overflow-hidden bg-card/30 p-4">
            {activeShot ? (
              <img
                src={shotUrls.get(activeShot.id)}
                alt="Vista previa"
                className="max-h-full max-w-full rounded-md object-contain"
              />
            ) : (
              <div className="text-sm text-muted-foreground">Selecciona una página</div>
            )}
          </div>

          <div className="grid auto-cols-[88px] grid-flow-col gap-2 overflow-x-auto border-t border-border/40 bg-card/40 p-3">
            {shots.map((shot, i) => {
              const isActive = activeId === shot.id;
              return (
                <button
                  key={shot.id}
                  type="button"
                  onClick={() => setActiveId(shot.id)}
                  className={cn(
                    "relative aspect-[3/4] overflow-hidden rounded-md ring-1 transition",
                    isActive ? "ring-2 ring-primary" : "ring-border/40 hover:ring-border",
                  )}
                  aria-pressed={isActive}
                >
                  <img
                    src={shotUrls.get(shot.id)}
                    alt={`Página ${i + 1}`}
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute top-1 left-1 grid size-5 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                    {i + 1}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border/40 bg-card/40 px-4 py-3">
            <Button variant="ghost" size="sm" onClick={() => setMode("capture")}>
              <Plus className="size-4" /> Tomar más
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => activeId && editShot(activeId)}
                disabled={!activeId}
              >
                <Edit3 className="size-4" /> Editar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => activeId && removeShot(activeId)}
                disabled={!activeId}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-4" /> Eliminar
              </Button>
            </div>
            <Button size="sm" onClick={finalize} disabled={shots.length === 0 || busy}>
              <Check className="size-4" /> Generar PDF
            </Button>
          </div>
        </>
      )}

      {editing && (
        <DocumentScannerEditor
          open
          sourceBlob={editing.sourceBlob}
          initialState={editing.state}
          onOpenChange={(o) => {
            if (!o) setEditing(null);
          }}
          onSave={onEditorSave}
        />
      )}
    </div>
  );
}
