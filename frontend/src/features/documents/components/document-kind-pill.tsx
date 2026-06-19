import { Pill, type PillTone } from "@shared/ui";
import type { DocumentItem } from "../types";

const KIND_LABEL: Record<DocumentItem["kind"], string> = {
  PDF: "PDF",
  DOCX: "DOCX",
  IMAGE_PDF: "Escaneado",
  OTHER: "Archivo",
};

/**
 * Document-kind chip. Scanned docs (`IMAGE_PDF`, or camera-origin) read as
 * "accent"; everything else stays neutral. Status semantics (firmado/vigente…)
 * don't exist on the document model yet — this reflects the file kind only.
 */
function toneFor(doc: DocumentItem): PillTone {
  if (doc.kind === "IMAGE_PDF" || doc.origin === "CAMERA") return "accent";
  return "neutral";
}

export function DocumentKindPill({ doc }: { doc: DocumentItem }) {
  return <Pill tone={toneFor(doc)}>{KIND_LABEL[doc.kind]}</Pill>;
}
