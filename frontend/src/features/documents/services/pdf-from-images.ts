import { PDFDocument } from "pdf-lib";
import { stripIdentityMetadata } from "./pdf-engine";

export async function imagesToPdf(blobs: Blob[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  for (const blob of blobs) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const isPng = blob.type === "image/png";
    const embedded = isPng ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
    const page = pdf.addPage([embedded.width, embedded.height]);
    page.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height });
  }
  stripIdentityMetadata(pdf);
  return pdf.save();
}
