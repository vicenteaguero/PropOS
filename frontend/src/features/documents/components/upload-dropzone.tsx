import { Upload } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { IMAGE_MIME, validateFile } from "../services/file-validation";
import { compressBlob } from "../services/image-compression";
import type { EditState } from "../services/scanner/types";
import { DocumentScannerEditor } from "./document-scanner-editor";

interface Props {
  onFile: (file: File, meta?: { editState?: EditState; raw?: Blob }) => void | Promise<void>;
  disabled?: boolean;
}

export function UploadDropzone({ onFile, disabled }: Props) {
  const [hover, setHover] = useState(false);
  const [pending, setPending] = useState<{ file: File; mime: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      const validation = await validateFile(file);
      if (!validation.ok || !validation.mime) {
        toast.error(validation.reason ?? "Archivo inválido");
        return;
      }
      if (IMAGE_MIME.has(validation.mime)) {
        setPending({ file, mime: validation.mime });
        return;
      }
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

      {pending && (
        <DocumentScannerEditor
          open
          sourceBlob={pending.file}
          onOpenChange={(o) => {
            if (!o) setPending(null);
          }}
          onSave={async ({ processed, state, raw }) => {
            const compressed = await compressBlob(processed, `scan-${Date.now()}.jpg`);
            await onFile(compressed, { editState: state, raw });
            setPending(null);
          }}
        />
      )}
    </>
  );
}
