import { useRef, useState, useCallback } from "react";
import { ImagePlus, Save, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMediaUpload } from "@shared/hooks/use-media-upload";
import { toast } from "sonner";

interface PhotoPickerProps {
  onSaved?: (url: string) => void;
}

export function PhotoPicker({ onSaved }: PhotoPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const { upload, uploading } = useMediaUpload();

  const handlePick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto(file);
    setPhotoUrl(URL.createObjectURL(file));
    e.target.value = "";
  }, []);

  function clearPhoto() {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhoto(null);
    setPhotoUrl(null);
  }

  async function handleSave() {
    if (!photo) return;
    const url = await upload(photo, "photo");
    if (url) {
      toast.success("Foto guardada");
      onSaved?.(url);
      clearPhoto();
    } else {
      toast.error("Error al guardar foto");
    }
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />

      {!photoUrl ? (
        <div className="flex justify-center">
          <Button variant="outline" className="gap-2" onClick={handlePick}>
            <ImagePlus className="size-4" />
            Elegir de Galería
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <img src={photoUrl} alt="Selected" className="w-full rounded-lg" />
          <div className="flex justify-center gap-3">
            <Button variant="outline" onClick={clearPhoto}>
              <RotateCcw className="mr-2 size-4" />
              Cambiar
            </Button>
            <Button onClick={handleSave} disabled={uploading}>
              <Save className="mr-2 size-4" />
              {uploading ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
