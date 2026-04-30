import { fileTypeFromBuffer } from "file-type";

export const MAX_FILE_BYTES = 50 * 1024 * 1024;

export const ALLOWED_MIME = new Set<string>([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export interface ValidationResult {
  ok: boolean;
  mime?: string;
  reason?: string;
}

export async function validateFile(file: File, maxBytes = MAX_FILE_BYTES): Promise<ValidationResult> {
  if (file.size === 0) return { ok: false, reason: "Archivo vacío" };
  if (file.size > maxBytes) return { ok: false, reason: `Excede ${(maxBytes / 1024 / 1024).toFixed(0)} MB` };
  const head = new Uint8Array(await file.slice(0, 4100).arrayBuffer());
  const detected = await fileTypeFromBuffer(head);
  const mime = detected?.mime;
  if (!mime) return { ok: false, reason: "Tipo de archivo no reconocible" };
  if (!ALLOWED_MIME.has(mime)) return { ok: false, reason: `Tipo no permitido: ${mime}` };
  return { ok: true, mime };
}
