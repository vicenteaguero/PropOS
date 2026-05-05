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

  // "enhance" is the legacy alias for "magic" — keep saved edit states working.
  const effectiveMode: FilterMode = mode === "enhance" ? "magic" : mode;

  const out = document.createElement("canvas");
  out.width = canvas.width;
  out.height = canvas.height;
  const ctx = out.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2d context unavailable");

  if (effectiveMode === "color") {
    // Stronger pop than before — IDs and laminated cards looked flat with the
    // earlier 1.10/1.05. Still preserves photos.
    ctx.filter = "contrast(1.18) saturate(1.12) brightness(1.03)";
    ctx.drawImage(canvas, 0, 0);
    ctx.filter = "none";
    return out;
  }

  ctx.drawImage(canvas, 0, 0);
  const img = ctx.getImageData(0, 0, out.width, out.height);
  const data = img.data;
  const w = out.width;
  const h = out.height;

  if (effectiveMode === "magic") {
    runMagic(data, w, h);
    ctx.putImageData(img, 0, 0);
    return out;
  }

  // Grayscale luminance buffer shared by bw + ink.
  const gray = new Uint8ClampedArray(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = (data[i]! * 0.299 + data[i + 1]! * 0.587 + data[i + 2]! * 0.114) | 0;
  }

  if (effectiveMode === "bw") {
    // Less aggressive C → preserves mid-tones on photos and IDs while still
    // binarizing crisp text. C=18 keeps faces/photos legible.
    const blur = boxBlur(gray, w, h, 14);
    const C = 18;
    for (let p = 0, i = 0; p < gray.length; p++, i += 4) {
      const v = gray[p]! < blur[p]! - C ? 0 : 255;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
    }
    ctx.putImageData(img, 0, 0);
    return out;
  }

  if (effectiveMode === "ink") {
    // Sauvola threshold: T = mean - k * stddev (k=0.2). Box-blur radius=12.
    const r = 12;
    const blur = boxBlur(gray, w, h, r);
    const sq = new Float32Array(w * h);
    for (let p = 0; p < gray.length; p++) sq[p] = gray[p]! * gray[p]!;
    const blurSq = boxBlurFloat(sq, w, h, r);
    const k = 0.2;
    for (let p = 0, i = 0; p < gray.length; p++, i += 4) {
      const mean = blur[p]!;
      const variance = Math.max(0, blurSq[p]! - mean * mean);
      const stddev = Math.sqrt(variance);
      const T = mean - k * stddev;
      const v = gray[p]! < T ? 0 : 255;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
    }
    ctx.putImageData(img, 0, 0);
    return out;
  }

  return out;
}

function runMagic(data: Uint8ClampedArray, w: number, h: number) {
  // ID-friendly enhancement: gentle gray-world WB + S-curve contrast +
  // light unsharp. No shadow-division (caused color casts on plastic IDs)
  // and no saturation push (kept colours faithful).
  const n = w * h;

  // Step 1: gray-world WB. Equalize per-channel means toward overall luma.
  let sumR = 0,
    sumG = 0,
    sumB = 0;
  for (let i = 0; i < data.length; i += 4) {
    sumR += data[i]!;
    sumG += data[i + 1]!;
    sumB += data[i + 2]!;
  }
  const meanR = sumR / n;
  const meanG = sumG / n;
  const meanB = sumB / n;
  const meanLuma = (meanR + meanG + meanB) / 3;
  // Cap correction so a heavily tinted image doesn't go neon.
  const limit = (g: number) => Math.max(0.85, Math.min(1.18, g));
  const gainR = limit(meanR > 0 ? meanLuma / meanR : 1);
  const gainG = limit(meanG > 0 ? meanLuma / meanG : 1);
  const gainB = limit(meanB > 0 ? meanLuma / meanB : 1);

  // Step 2: contrast S-curve around mid-grey using a fast quintic.
  // y = 255 * smoothstep(0, 1, x/255) blended 70/30 with identity.
  const lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) {
    const t = v / 255;
    const s = t * t * (3 - 2 * t); // smoothstep
    const out = 0.7 * (s * 255) + 0.3 * v;
    lut[v] = out < 0 ? 0 : out > 255 ? 255 : out | 0;
  }
  for (let i = 0; i < data.length; i += 4) {
    data[i] = lut[clamp255(data[i]! * gainR) | 0]!;
    data[i + 1] = lut[clamp255(data[i + 1]! * gainG) | 0]!;
    data[i + 2] = lut[clamp255(data[i + 2]! * gainB) | 0]!;
  }

  // Step 3: per-channel unsharp mask radius 2. Subtle, just enough to crisp.
  const r = 2;
  const ch = new Uint8ClampedArray(w * h);
  for (let c = 0; c < 3; c++) {
    for (let p = 0, i = c; p < n; p++, i += 4) ch[p] = data[i]!;
    const blurC = boxBlur(ch, w, h, r);
    for (let p = 0, i = c; p < n; p++, i += 4) {
      data[i] = clamp255(1.25 * ch[p]! - 0.25 * blurC[p]!);
    }
  }
}

function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

function boxBlur(src: Uint8ClampedArray, w: number, h: number, r: number): Uint8ClampedArray {
  const tmp = new Uint8ClampedArray(w * h);
  const out = new Uint8ClampedArray(w * h);
  const size = 2 * r + 1;
  // Horizontal.
  for (let y = 0; y < h; y++) {
    let sum = 0;
    for (let x = -r; x <= r; x++) sum += src[y * w + Math.max(0, Math.min(w - 1, x))]!;
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = (sum / size) | 0;
      const xAdd = Math.min(w - 1, x + r + 1);
      const xRem = Math.max(0, x - r);
      sum += src[y * w + xAdd]! - src[y * w + xRem]!;
    }
  }
  // Vertical.
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = -r; y <= r; y++) sum += tmp[Math.max(0, Math.min(h - 1, y)) * w + x]!;
    for (let y = 0; y < h; y++) {
      out[y * w + x] = (sum / size) | 0;
      const yAdd = Math.min(h - 1, y + r + 1);
      const yRem = Math.max(0, y - r);
      sum += tmp[yAdd * w + x]! - tmp[yRem * w + x]!;
    }
  }
  return out;
}

function boxBlurFloat(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const size = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    let sum = 0;
    for (let x = -r; x <= r; x++) sum += src[y * w + Math.max(0, Math.min(w - 1, x))]!;
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = sum / size;
      const xAdd = Math.min(w - 1, x + r + 1);
      const xRem = Math.max(0, x - r);
      sum += src[y * w + xAdd]! - src[y * w + xRem]!;
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = -r; y <= r; y++) sum += tmp[Math.max(0, Math.min(h - 1, y)) * w + x]!;
    for (let y = 0; y < h; y++) {
      out[y * w + x] = sum / size;
      const yAdd = Math.min(h - 1, y + r + 1);
      const yRem = Math.max(0, y - r);
      sum += tmp[yAdd * w + x]! - tmp[yRem * w + x]!;
    }
  }
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
