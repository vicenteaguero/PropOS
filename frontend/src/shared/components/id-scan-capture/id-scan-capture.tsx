import { useEffect, useRef, useState } from "react";
import { Camera, Check, Loader2, RotateCcw, SwitchCamera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCamera } from "@shared/hooks/use-camera";
import { imagesToPdf } from "@features/documents/services/pdf-from-images";
import { compressBlob } from "@features/documents/services/image-compression";
import { toast } from "sonner";
import { ResponsiveSheet } from "@shared/ui";

interface Props {
  onComplete: (pdfBlob: Blob) => Promise<void>;
  disabled?: boolean;
}

type Step = "front" | "front-preview" | "back" | "back-preview" | "rendering" | "done";

/**
 * Locked ID-card scanner. Default rear camera (`environment`), flip available.
 * 2 shots (front + back) → single A4 PDF via `imagesToPdf({mode:'id'})`.
 * No quad-edit, no crop, no filter UI. Visitor never sees the resulting PDF.
 */
export function IdScanCapture({ onComplete, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [step, setStep] = useState<Step>("front");
  const [front, setFront] = useState<Blob | null>(null);
  const [back, setBack] = useState<Blob | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const camera = useCamera();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (camera.stream && videoRef.current) {
      videoRef.current.srcObject = camera.stream;
    }
  }, [camera.stream]);

  useEffect(() => {
    if (open) {
      setStep("front");
      setFront(null);
      setBack(null);
      camera.startCamera(facingMode);
    } else {
      camera.stopCamera();
      camera.clearPhoto();
    }
    // Deliberate narrow deps: Open/close lifecycle. `camera` is a fresh object each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleFlip() {
    const next = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    camera.stopCamera();
    camera.startCamera(next);
  }

  function handleCapture() {
    camera.takePhoto();
  }

  // when useCamera produces a photo, advance step
  useEffect(() => {
    if (!camera.photo) return;
    if (step === "front") {
      setFront(camera.photo);
      setStep("front-preview");
    } else if (step === "back") {
      setBack(camera.photo);
      setStep("back-preview");
    }
  }, [camera.photo, step]);

  function retryCurrent() {
    camera.clearPhoto();
    if (step === "front-preview") setStep("front");
    if (step === "back-preview") setStep("back");
  }

  function continueToBack() {
    camera.clearPhoto();
    setStep("back");
  }

  async function finalize() {
    if (!front || !back) return;
    setStep("rendering");
    setSubmitting(true);
    try {
      const compressedFront = await compressBlob(front, "front.jpg", {
        maxSizeMB: 0.6,
        maxWidthOrHeight: 1800,
      }).catch(() => front);
      const compressedBack = await compressBlob(back, "back.jpg", {
        maxSizeMB: 0.6,
        maxWidthOrHeight: 1800,
      }).catch(() => back);
      const pdfBytes = await imagesToPdf([compressedFront, compressedBack], {
        mode: "id",
        paperSize: "A4",
      });
      const pdf = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
      await onComplete(pdf);
      setStep("done");
      setOpen(false);
      toast.success("Cédula registrada");
    } catch (err) {
      toast.error("Error al generar el PDF de la cédula");
      setStep("back-preview");
    } finally {
      setSubmitting(false);
    }
  }

  function restart() {
    setFront(null);
    setBack(null);
    camera.clearPhoto();
    setStep("front");
  }

  return (
    <>
      <Button variant="outline" disabled={disabled} className="gap-2" onClick={() => setOpen(true)}>
        <Camera className="size-4" /> Escanear cédula
      </Button>
      <ResponsiveSheet
        open={open}
        onOpenChange={setOpen}
        title={
          step === "front" || step === "front-preview"
            ? "Frente de la cédula"
            : step === "back" || step === "back-preview"
              ? "Reverso de la cédula"
              : step === "rendering"
                ? "Generando…"
                : "Cédula"
        }
        desktopClassName="max-w-md"
      >
        {camera.error && <p className="text-sm text-destructive">{camera.error}</p>}
        {(step === "front" || step === "back") && (
          <div className="space-y-3">
            <div className="relative aspect-[1.586/1] overflow-hidden rounded-lg bg-muted">
              {camera.isActive && (
                <video
                  ref={videoRef}
                  data-camera-viewfinder
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full object-cover"
                />
              )}
              <div className="pointer-events-none absolute inset-3 rounded-md border-2 border-primary/60" />
            </div>
            <p className="text-center text-xs text-muted-foreground">
              {step === "front"
                ? "Encuadrá el frente. Cámara trasera recomendada."
                : "Da vuelta la cédula y encuadrá el reverso."}
            </p>
            <div className="flex justify-center gap-3">
              <Button variant="outline" size="icon" onClick={handleFlip} title="Cambiar cámara">
                <SwitchCamera className="size-4" />
              </Button>
              <Button size="lg" onClick={handleCapture} disabled={!camera.isActive}>
                <Camera className="mr-2 size-4" /> Capturar
              </Button>
            </div>
          </div>
        )}
        {(step === "front-preview" || step === "back-preview") && camera.photoUrl && (
          <div className="space-y-3">
            <img src={camera.photoUrl} alt="Captura" className="w-full rounded-lg" />
            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={retryCurrent}>
                <RotateCcw className="mr-2 size-4" /> Repetir
              </Button>
              {step === "front-preview" ? (
                <Button onClick={continueToBack}>
                  <Check className="mr-2 size-4" /> Continuar al reverso
                </Button>
              ) : (
                <Button onClick={finalize} disabled={submitting}>
                  {submitting ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 size-4" />
                  )}
                  Generar PDF
                </Button>
              )}
            </div>
            {step === "back-preview" && (
              <button
                type="button"
                className="mx-auto block text-xs text-muted-foreground underline"
                onClick={restart}
              >
                <X className="mr-1 inline size-3" /> Volver a empezar
              </button>
            )}
          </div>
        )}
        {step === "rendering" && (
          <div className="flex flex-col items-center gap-3 py-10">
            <Loader2 className="size-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Generando PDF…</p>
          </div>
        )}
      </ResponsiveSheet>
    </>
  );
}
