import { PDFDocument, type PDFImage } from "pdf-lib";
import { stripIdentityMetadata } from "./pdf-engine";

const LETTER = { w: 612, h: 792 };
const A4 = { w: 595.28, h: 841.89 };
const MARGIN_PT = 28.35; // 1 cm
const ID_CARD_WIDTH_PT = 283.46; // ≈ 10cm at 72dpi.

export type PdfMode = "document" | "id";

export interface PdfPageOptions {
  pageWidth?: number;
  pageHeight?: number;
  marginPt?: number;
  mode?: PdfMode;
}

export async function imagesToPdf(blobs: Blob[], opts: PdfPageOptions = {}): Promise<Uint8Array> {
  const mode: PdfMode = opts.mode ?? "document";
  if (mode === "id") return imagesToIdPdf(blobs, opts);
  return imagesToDocumentPdf(blobs, opts);
}

async function imagesToDocumentPdf(blobs: Blob[], opts: PdfPageOptions): Promise<Uint8Array> {
  const pageW = opts.pageWidth ?? LETTER.w;
  const pageH = opts.pageHeight ?? LETTER.h;
  const margin = opts.marginPt ?? MARGIN_PT;

  const pdf = await PDFDocument.create();
  for (const blob of blobs) {
    const embedded = await embedBlob(pdf, blob);
    const imgW = embedded.width;
    const imgH = embedded.height;
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

/**
 * ID layout: A4 portrait pages. Single image renders ~10cm wide, centered in
 * the top third of the page. Two or more images stack two per page (top half +
 * bottom half), expecting landscape input — auto-rotate-to-landscape happens
 * upstream in the warp.
 */
async function imagesToIdPdf(blobs: Blob[], opts: PdfPageOptions): Promise<Uint8Array> {
  const pageW = opts.pageWidth ?? A4.w;
  const pageH = opts.pageHeight ?? A4.h;
  const margin = opts.marginPt ?? MARGIN_PT;

  const pdf = await PDFDocument.create();

  if (blobs.length === 1) {
    const embedded = await embedBlob(pdf, blobs[0]!);
    const targetW = ID_CARD_WIDTH_PT;
    const scale = targetW / embedded.width;
    const drawW = embedded.width * scale;
    const drawH = embedded.height * scale;
    const x = (pageW - drawW) / 2;
    // Top third center: page-top minus margin minus image height shifted to
    // sit roughly 1/6 down the page.
    const topThirdCenterY = pageH * (5 / 6);
    const y = topThirdCenterY - drawH / 2;
    const page = pdf.addPage([pageW, pageH]);
    page.drawImage(embedded, { x, y, width: drawW, height: drawH });
    stripIdentityMetadata(pdf);
    return pdf.save();
  }

  // 2+ images: two per A4 portrait page, top half + bottom half.
  const halfH = (pageH - 2 * margin) / 2;
  const slotW = pageW - 2 * margin;
  for (let i = 0; i < blobs.length; i += 2) {
    const page = pdf.addPage([pageW, pageH]);
    for (let k = 0; k < 2; k++) {
      const blob = blobs[i + k];
      if (!blob) break;
      const embedded = await embedBlob(pdf, blob);
      const scale = Math.min(slotW / embedded.width, halfH / embedded.height);
      const drawW = embedded.width * scale;
      const drawH = embedded.height * scale;
      const x = (pageW - drawW) / 2;
      // k=0 -> top half, k=1 -> bottom half.
      const slotCenterY = k === 0 ? pageH - margin - halfH / 2 : margin + halfH / 2;
      const y = slotCenterY - drawH / 2;
      page.drawImage(embedded, { x, y, width: drawW, height: drawH });
    }
  }
  stripIdentityMetadata(pdf);
  return pdf.save();
}

async function embedBlob(pdf: PDFDocument, blob: Blob): Promise<PDFImage> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const isPng = blob.type === "image/png";
  return isPng ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
}
