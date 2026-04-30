import { loadPdf, pdfToBytes, stripIdentityMetadata } from "./pdf-engine";

export interface CleanOptions {
  displayName: string;
}

export async function cleanPdfMetadata(bytes: Uint8Array, opts: CleanOptions): Promise<Uint8Array> {
  const pdf = await loadPdf(bytes);
  stripIdentityMetadata(pdf);
  pdf.setTitle(opts.displayName);
  return pdfToBytes(pdf);
}
