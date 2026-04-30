import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Check, RotateCcw, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { compressBlob } from "../services/image-compression";
import { imagesToPdf } from "../services/pdf-from-images";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPdfReady: (pdfBytes: Uint8Array) => void;
}

interface Shot {
  id: string;
  blob: Blob;
}

export function CameraCaptureDocument({ open, onOpenChange, onPdfReady }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [busy, setBusy] = useState(false);
  const [fallback, setFallback] = useState(false);

  // Genera URLs solo cuando shots cambia, revoca anteriores → no leak.
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
      setFallback(false);
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
    setShots((prev) => [...prev, { id: crypto.randomUUID(), blob: compressed }]);
  };

  const handleFileFallback = async (files: FileList | null) => {
    if (!files) return;
    const arr: Shot[] = [];
    for (const file of Array.from(files)) {
      arr.push({ id: crypto.randomUUID(), blob: await compressBlob(file, file.name) });
    }
    setShots((prev) => [...prev, ...arr]);
  };

  const removeShot = (id: string) =>
    setShots((prev) => prev.filter((s) => s.id !== id));

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
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-3 text-white">
        <div className="text-sm font-medium">Cámara · {shots.length} pág.</div>
        <Button
          variant="ghost"
          size="icon"
          onClick={closeWithGuard}
          className="text-white hover:bg-white/10"
        >
          <X className="size-5" />
        </Button>
      </div>
      <div className="flex flex-1 items-center justify-center overflow-hidden">
        {fallback ? (
          <label className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-white/40 p-8 text-center text-white">
            <Camera className="size-10" strokeWidth={1.4} />
            <span className="text-sm">Cámara no disponible. Selecciona fotos.</span>
            <input
              type="file"
              accept="image/*"
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
        <div className="flex gap-2 overflow-x-auto border-t border-border/50 px-4 py-3">
          {shots.map((shot, i) => (
            <div key={shot.id} className="relative shrink-0">
              <img
                src={shotUrls[i]}
                alt={`shot ${i + 1}`}
                className="h-20 w-16 rounded object-cover"
              />
              <button
                type="button"
                onClick={() => removeShot(shot.id)}
                className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-white"
                aria-label="Eliminar"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center justify-around border-t border-border/50 px-4 py-3">
        <Button
          variant="ghost"
          size="lg"
          onClick={() => setShots([])}
          className="text-white"
          disabled={shots.length === 0}
        >
          <RotateCcw className="size-5" /> Reiniciar
        </Button>
        {!fallback && (
          <Button
            size="lg"
            onClick={captureShot}
            className="rounded-full bg-white text-black hover:bg-white/80"
          >
            <Camera className="size-6" />
          </Button>
        )}
        <Button
          size="lg"
          onClick={finalize}
          disabled={shots.length === 0 || busy}
          className="bg-primary"
        >
          <Check className="size-5" /> Listo
        </Button>
      </div>
    </div>
  );
}
