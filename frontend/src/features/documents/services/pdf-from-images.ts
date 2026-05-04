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
    const portraitWaste = wastedArea(imgW, imgH, pageW, pageH, margin);
    const landscapeWaste = wastedArea(imgW, imgH, pageH, pageW, margin);
    const landscape = landscapeWaste < portraitWaste;
    const pW = landscape ? pageH : pageW;
    const pH = landscape ? pageW : pageH;

    const contentW = pW - 2 * margin;
    const contentH = pH - 2 * margin;
    const scale = Math.min(contentW / imgW, contentH / imgH);
    const drawW = imgW * scale;
    const drawH = imgH * scale;
    const x = (pW - drawW) / 2;
    const y = (pH - drawH) / 2;

    const page = pdf.addPage([pW, pH]);
    page.drawImage(embedded, { x, y, width: drawW, height: drawH });
  }
  stripIdentityMetadata(pdf);
  return pdf.save();
}

function wastedArea(imgW: number, imgH: number, pageW: number, pageH: number, margin: number): number {
  const contentW = pageW - 2 * margin;
  const contentH = pageH - 2 * margin;
  if (contentW <= 0 || contentH <= 0) return Infinity;
  const scale = Math.min(contentW / imgW, contentH / imgH);
  const drawW = imgW * scale;
  const drawH = imgH * scale;
  return pageW * pageH - drawW * drawH;
}
