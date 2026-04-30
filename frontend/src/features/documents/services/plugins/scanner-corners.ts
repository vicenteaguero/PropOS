// Plug-in interface — V1 noop. V2 conectar OpenCV.js (corner detection + perspective transform).

export interface ScannerProvider {
  readonly name: string;
  available(): boolean;
  enhance(blob: Blob): Promise<Blob>;
}

export const noopScanner: ScannerProvider = {
  name: "noop",
  available: () => false,
  async enhance(blob) {
    return blob;
  },
};

let active: ScannerProvider = noopScanner;

export function registerScanner(provider: ScannerProvider): void {
  active = provider;
}

export function getScanner(): ScannerProvider {
  return active;
}
