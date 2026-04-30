// Plug-in interface — V1 noop. V2 conectar Tesseract.js cliente o backend OCR.

export interface OCRProvider {
  readonly name: string;
  available(): boolean;
  extractText(blob: Blob): Promise<string>;
}

export const noopOCR: OCRProvider = {
  name: "noop",
  available: () => false,
  async extractText() {
    throw new Error("OCR no implementado (V1)");
  },
};

let active: OCRProvider = noopOCR;

export function registerOCR(provider: OCRProvider): void {
  active = provider;
}

export function getOCR(): OCRProvider {
  return active;
}
