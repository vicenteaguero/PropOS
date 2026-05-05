import type { FilterMode } from "./types";

/**
 * Pure-canvas filters. No OpenCV — all pixel work runs against ImageData
 * directly so it stays fast on mobile and never pulls in the 10MB WASM blob.
 */
export async function applyFilter(
  canvas: HTMLCanvasElement,
  mode: FilterMode,
): Promise<HTMLCanvasElement> {
  if (mode === "none") return canvas;

  const out = document.createElement("canvas");
  out.width = canvas.width;
  out.height = canvas.height;
  const ctx = out.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2d context unavailable");

  if (mode === "enhance") {
    // CSS-style filter pipeline runs on the GPU. Slight contrast / saturation
    // / brightness lift to make ID photos & contracts pop without clipping.
    ctx.filter = "contrast(1.18) saturate(1.12) brightness(1.05)";
    ctx.drawImage(canvas, 0, 0);
    ctx.filter = "none";
    return out;
  }

  // B&W: high-contrast grayscale via local mean threshold (CamScanner-ish).
  ctx.drawImage(canvas, 0, 0);
  const img = ctx.getImageData(0, 0, out.width, out.height);
  const data = img.data;
  const w = out.width;
  const h = out.height;

  // Convert to grayscale into a separate buffer so we can sample neighbours.
  const gray = new Uint8ClampedArray(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = (data[i]! * 0.299 + data[i + 1]! * 0.587 + data[i + 2]! * 0.114) | 0;
  }

  // Box-blur for local mean (radius=12px). Separable for speed.
  const r = 12;
  const blur = new Uint8ClampedArray(w * h);
  const tmp = new Uint8ClampedArray(w * h);
  // Horizontal.
  for (let y = 0; y < h; y++) {
    let sum = 0;
    for (let x = -r; x <= r; x++) sum += gray[y * w + Math.max(0, Math.min(w - 1, x))]!;
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = (sum / (2 * r + 1)) | 0;
      const xAdd = Math.min(w - 1, x + r + 1);
      const xRem = Math.max(0, x - r);
      sum += gray[y * w + xAdd]! - gray[y * w + xRem]!;
    }
  }
  // Vertical.
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = -r; y <= r; y++) sum += tmp[Math.max(0, Math.min(h - 1, y)) * w + x]!;
    for (let y = 0; y < h; y++) {
      blur[y * w + x] = (sum / (2 * r + 1)) | 0;
      const yAdd = Math.min(h - 1, y + r + 1);
      const yRem = Math.max(0, y - r);
      sum += tmp[yAdd * w + x]! - tmp[yRem * w + x]!;
    }
  }

  // Threshold pixel against (local mean - C). C=12 keeps mid-tones readable.
  const C = 12;
  for (let p = 0, i = 0; p < gray.length; p++, i += 4) {
    const v = gray[p]! < blur[p]! - C ? 0 : 255;
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

export async function canvasToJpegBlob(canvas: HTMLCanvasElement, quality = 0.85): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/jpeg",
      quality,
    );
  });
}
