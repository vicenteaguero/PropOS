import { Upload } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { validateFile } from "../services/file-validation";
import type { EditState } from "../services/scanner/types";

interface Props {
  onFile: (file: File, meta?: { editState?: EditState; raw?: Blob }) => void | Promise<void>;
  disabled?: boolean;
}

export function UploadDropzone({ onFile, disabled }: Props) {
  const [hover, setHover] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      const validation = await validateFile(file);
      if (!validation.ok || !validation.mime) {
        toast.error(validation.reason ?? "Archivo inválido");
        return;
      }
      // Scanner editor is opt-in: upload goes straight through. User can
      // open the editor later from the document detail / version drawer.
      await onFile(file);
    },
    [onFile],
  );

  return (
    <>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setHover(true);
        }}
        onDragLeave={() => setHover(false)}
        onDrop={(e) => {
          e.preventDefault();
          setHover(false);
          handle(e.dataTransfer.files?.[0]);
        }}
        className={`flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          hover ? "border-primary bg-primary/5" : "border-border"
        }`}
      >
        <Upload className="size-10 text-primary/60" strokeWidth={1.2} />
        <div>
          <p className="text-sm font-medium">Arrastra un archivo aquí</p>
          <p className="text-xs text-muted-foreground">
            PDF, DOCX, JPG, PNG, WebP, HEIC — hasta 50 MB
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          Seleccionar archivo
        </Button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(e) => handle(e.target.files?.[0])}
        />
      </div>

    </>
  );
}
