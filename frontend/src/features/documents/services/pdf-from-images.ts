import { PDFDocument, type PDFImage } from "pdf-lib";
import { stripIdentityMetadata } from "./pdf-engine";

const LETTER = { w: 612, h: 792 };
const MARGIN_PT = 28.35; // 1 cm

export interface PdfPageOptions {
  pageWidth?: number;
  pageHeight?: number;
  marginPt?: number;
}

export async function imagesToPdf(blobs: Blob[], opts: PdfPageOptions = {}): Promise<Uint8Array> {
  const pageW = opts.pageWidth ?? LETTER.w;
  const pageH = opts.pageHeight ?? LETTER.h;
  const margin = opts.marginPt ?? MARGIN_PT;

  const pdf = await PDFDocument.create();
  for (const blob of blobs) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const isPng = blob.type === "image/png";
    const embedded: PDFImage = isPng ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);

    const imgW = embedded.width;
    const imgH = embedded.height;
    // Always Letter portrait. Landscape inputs are pre-rotated upstream
    // (perspective-warp + DocScanner harness both rotate to portrait).
    const contentW = pageW - 2 * margin;
    const contentH = pageH - 2 * margin;
    const scale = Math.min(contentW / imgW, contentH / imgH);
    const drawW = imgW * scale;
    const drawH = imgH * scale;
    const x = (pageW - drawW) / 2;
    const y = (pageH - drawH) / 2;

    const page = pdf.addPage([pageW, pageH]);
    page.drawImage(embedded, { x, y, width: drawW, height: drawH });
  }
  stripIdentityMetadata(pdf);
  return pdf.save();
}
