import { useEffect, useRef, useState } from "react";
import { Camera, SwitchCamera, RotateCcw, Save } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCamera } from "@shared/hooks/use-camera";
import { useMediaUpload } from "@shared/hooks/use-media-upload";
import { toast } from "sonner";

interface CameraCaptureProps {
  onSaved?: (url: string) => void;
}

export function CameraCapture({ onSaved }: CameraCaptureProps) {
  const [open, setOpen] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const { stream, photo, photoUrl, isActive, error, startCamera, stopCamera, takePhoto, clearPhoto } = useCamera();
  const { upload, uploading } = useMediaUpload();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    if (open) {
      startCamera(facingMode);
    } else {
      stopCamera();
      clearPhoto();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleFlip() {
    const newMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(newMode);
    stopCamera();
    startCamera(newMode);
  }

  async function handleSave() {
    if (!photo) return;
    const url = await upload(photo, "photo");
    if (url) {
      toast.success("Foto guardada");
      onSaved?.(url);
      setOpen(false);
    } else {
      toast.error("Error al guardar foto");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Camera className="size-4" />
          Abrir Cámara
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cámara</DialogTitle>
        </DialogHeader>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {!photoUrl ? (
          <div className="space-y-3">
            <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-muted">
              {isActive && (
                <video
                  ref={videoRef}
                  data-camera-viewfinder
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full object-cover"
                />
              )}
            </div>
            <div className="flex justify-center gap-3">
              <Button variant="outline" size="icon" onClick={handleFlip}>
                <SwitchCamera className="size-4" />
              </Button>
              <Button size="lg" onClick={takePhoto} disabled={!isActive}>
                <Camera className="mr-2 size-4" />
                Capturar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <img src={photoUrl} alt="Captured" className="w-full rounded-lg" />
            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={clearPhoto}>
                <RotateCcw className="mr-2 size-4" />
                Reintentar
              </Button>
              <Button onClick={handleSave} disabled={uploading}>
                <Save className="mr-2 size-4" />
                {uploading ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
