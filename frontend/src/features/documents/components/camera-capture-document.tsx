import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Check, RotateCcw, Trash2, X } from "lucide-react";
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

export function CameraCaptureDocument({ open, onOpenChange, onPdfReady }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [busy, setBusy] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{
    id?: string;
    sourceBlob: Blob;
    state?: EditState;
  } | null>(null);

  const shotUrls = useMemo(() => shots.map((s) => URL.createObjectURL(s.blob)), [shots]);
  useEffect(() => {
    return () => shotUrls.forEach((u) => URL.revokeObjectURL(u));
  }, [shotUrls]);

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
      setSelectedId(null);
      setFallback(false);
      setEditing(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } },
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
        console.warn("camera unavailable, fallback to file input", e);
        setFallback(true);
      }
    })();
    return () => {
      cancelled = true;
      stopStream();
    };
  }, [open, stopStream]);

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
    const compressed = await compressBlob(blob, `shot-${Date.now()}.jpg`);
    setShots((prev) => [...prev, { id: crypto.randomUUID(), blob: compressed, raw: blob }]);
  };

  const handleFileFallback = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      const compressed = await compressBlob(file, `shot-${Date.now()}.jpg`);
      setShots((prev) => [...prev, { id: crypto.randomUUID(), blob: compressed, raw: file }]);
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

  const removeSelected = () => {
    if (!selectedId) return;
    setShots((prev) => prev.filter((s) => s.id !== selectedId));
    setSelectedId(null);
  };

  const editSelected = (id: string) => {
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

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-overlay/95 text-foreground">
      <div className="flex items-center justify-between border-b border-border/30 px-4 py-3">
        <div className="text-sm font-medium">Cámara · {shots.length} pág.</div>
        <Button variant="ghost" size="icon" onClick={closeWithGuard}>
          <X className="size-5" />
        </Button>
      </div>
      <div className="flex flex-1 items-center justify-center overflow-hidden">
        {fallback ? (
          <label className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-border/60 p-8 text-center">
            <Camera className="size-10" strokeWidth={1.4} />
            <span className="text-sm">Cámara no disponible. Selecciona fotos.</span>
            <input
              type="file"
              accept="image/*,.heic,.heif"
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
        <div className="flex items-center gap-2 overflow-x-auto border-t border-border/30 px-4 py-3">
          {shots.map((shot, i) => {
            const isSelected = selectedId === shot.id;
            return (
              <button
                type="button"
                key={shot.id}
                onClick={() => {
                  if (isSelected) editSelected(shot.id);
                  else setSelectedId(shot.id);
                }}
                className={cn(
                  "shrink-0 overflow-hidden rounded transition",
                  isSelected
                    ? "ring-2 ring-primary scale-105"
                    : "ring-1 ring-border/40 hover:ring-border",
                )}
                aria-pressed={isSelected}
                aria-label={`Página ${i + 1}`}
              >
                <img src={shotUrls[i]} alt={`shot ${i + 1}`} className="h-20 w-16 object-cover" />
              </button>
            );
          })}
          {selectedId && (
            <Button variant="destructive" size="sm" onClick={removeSelected} className="shrink-0">
              <Trash2 className="size-4" /> Eliminar página
            </Button>
          )}
        </div>
      )}
      <div className="flex items-center justify-around border-t border-border/30 px-4 py-3">
        <Button
          variant="ghost"
          size="lg"
          onClick={() => {
            setShots([]);
            setSelectedId(null);
          }}
          disabled={shots.length === 0}
        >
          <RotateCcw className="size-5" /> Reiniciar
        </Button>
        {!fallback && (
          <Button
            size="lg"
            onClick={captureShot}
            className="rounded-full bg-foreground text-background hover:bg-foreground/85"
          >
            <Camera className="size-6" />
          </Button>
        )}
        <Button size="lg" onClick={finalize} disabled={shots.length === 0 || busy}>
          <Check className="size-5" /> Listo
        </Button>
      </div>

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
