import { Upload } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { validateFile } from "../services/file-validation";
import type { EditState } from "../services/scanner/types";

interface Props {
  onFile: (file: File, meta?: { editState?: EditState; raw?: Blob }) => void | Promise<void>;
  disabled?: boolean;
  /** Tile-style render: aspect-locked card matching the camera tile in the
   * "Nuevo documento" picker. Default is the original full-width dropzone. */
  compact?: boolean;
}

export function UploadDropzone({ onFile, disabled, compact }: Props) {
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

  if (compact) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
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
        className={`group flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
          hover
            ? "border-primary bg-primary/5"
            : "border-dashed border-border bg-card hover:border-primary/60 hover:bg-card/70"
        }`}
      >
        <span
          className={`grid size-10 shrink-0 place-items-center rounded-full bg-primary/15 text-primary transition group-hover:bg-primary/25 ${hover ? "scale-110" : ""}`}
        >
          <Upload className="size-5" strokeWidth={1.7} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-foreground">Subir archivo</span>
          <span className="block text-[12px] leading-tight text-muted-foreground">
            Arrastra o selecciona
          </span>
        </span>
        <input
          aria-label="Seleccionar archivo"
          ref={inputRef}
          type="file"
          className="hidden"
          accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(e) => handle(e.target.files?.[0])}
        />
      </button>
    );
  }

  return (
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
        aria-label="Seleccionar archivo"
        ref={inputRef}
        type="file"
        className="hidden"
        accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={(e) => handle(e.target.files?.[0])}
      />
    </div>
  );
}
