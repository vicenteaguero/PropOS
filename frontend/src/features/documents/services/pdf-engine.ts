import { PDFDocument } from "pdf-lib";

export async function loadPdf(bytes: ArrayBuffer | Uint8Array): Promise<PDFDocument> {
  return PDFDocument.load(bytes, { ignoreEncryption: true });
}

export async function pdfToBytes(pdf: PDFDocument): Promise<Uint8Array> {
  return pdf.save({ useObjectStreams: true });
}

export interface ReorderInstruction {
  sourceDocIndex: number;
  pageIndex: number;
}

export async function buildReorderedPdf(
  sourceDocs: PDFDocument[],
  instructions: ReorderInstruction[],
): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  for (const ins of instructions) {
    const src = sourceDocs[ins.sourceDocIndex];
    if (!src) continue;
    const [page] = await out.copyPages(src, [ins.pageIndex]);
    out.addPage(page);
  }
  stripIdentityMetadata(out);
  return pdfToBytes(out);
}

export function stripIdentityMetadata(pdf: PDFDocument): void {
  pdf.setProducer("PropOS");
  pdf.setCreator("PropOS");
  pdf.setAuthor("");
  pdf.setTitle("");
  pdf.setSubject("");
  pdf.setKeywords([]);
}

export async function mergePdfs(pdfs: Uint8Array[]): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  for (const bytes of pdfs) {
    const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  stripIdentityMetadata(out);
  return pdfToBytes(out);
}

export async function pageCount(bytes: ArrayBuffer | Uint8Array): Promise<number> {
  const pdf = await loadPdf(bytes);
  return pdf.getPageCount();
}
