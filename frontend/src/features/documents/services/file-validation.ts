import { fileTypeFromBuffer } from "file-type";

export const MAX_FILE_BYTES = 50 * 1024 * 1024;

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const ALLOWED_MIME = new Set<string>([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  DOCX_MIME,
]);

export interface ValidationResult {
  ok: boolean;
  mime?: string;
  reason?: string;
}

// Verifica que un blob ZIP contiene la estructura DOCX (no es un JAR/APK arbitrario).
// Lee EOCD + central directory para extraer nombres sin descomprimir.
async function looksLikeDocx(file: File): Promise<boolean> {
  try {
    const tail = new Uint8Array(
      await file.slice(Math.max(0, file.size - 65536)).arrayBuffer(),
    );
    // Buscar EOCD signature 0x06054b50
    let eocd = -1;
    for (let i = tail.length - 22; i >= 0; i--) {
      if (
        tail[i] === 0x50 &&
        tail[i + 1] === 0x4b &&
        tail[i + 2] === 0x05 &&
        tail[i + 3] === 0x06
      ) {
        eocd = i;
        break;
      }
    }
    if (eocd < 0) return false;
    const view = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
    const cdOffset = view.getUint32(eocd + 16, true);
    const cdSize = view.getUint32(eocd + 12, true);
    const tailOffsetInFile = file.size - tail.length;
    const centralStart = cdOffset - tailOffsetInFile;
    if (centralStart < 0 || centralStart + cdSize > tail.length) return false;
    const decoder = new TextDecoder("utf-8");
    let p = centralStart;
    const names: string[] = [];
    while (p < centralStart + cdSize - 46) {
      if (view.getUint32(p, true) !== 0x02014b50) break;
      const nameLen = view.getUint16(p + 28, true);
      const extraLen = view.getUint16(p + 30, true);
      const commentLen = view.getUint16(p + 32, true);
      names.push(decoder.decode(tail.subarray(p + 46, p + 46 + nameLen)));
      p += 46 + nameLen + extraLen + commentLen;
    }
    return (
      names.includes("[Content_Types].xml") &&
      names.includes("word/document.xml")
    );
  } catch {
    return false;
  }
}

export async function validateFile(file: File, maxBytes = MAX_FILE_BYTES): Promise<ValidationResult> {
  if (file.size === 0) return { ok: false, reason: "Archivo vacío" };
  if (file.size > maxBytes) return { ok: false, reason: `Excede ${(maxBytes / 1024 / 1024).toFixed(0)} MB` };
  const head = new Uint8Array(await file.slice(0, 4100).arrayBuffer());
  const detected = await fileTypeFromBuffer(head);
  const mime = detected?.mime;
  if (!mime) return { ok: false, reason: "Tipo de archivo no reconocible" };
  if (!ALLOWED_MIME.has(mime)) return { ok: false, reason: `Tipo no permitido: ${mime}` };
  if (mime === DOCX_MIME && !(await looksLikeDocx(file))) {
    return { ok: false, reason: "Archivo ZIP no es un DOCX válido" };
  }
  return { ok: true, mime };
}
