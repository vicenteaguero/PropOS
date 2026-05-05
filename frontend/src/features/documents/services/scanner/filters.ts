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
    ctx.filter = "contrast(1.1) saturate(1.05)";
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
    const blur = boxBlur(gray, w, h, 12);
    const C = 10;
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
  // Step 1: grayscale luminance for background estimation.
  const gray = new Uint8ClampedArray(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = (data[i]! * 0.299 + data[i + 1]! * 0.587 + data[i + 2]! * 0.114) | 0;
  }
  // Step 2: large radius box-blur for background estimation.
  const background = boxBlur(gray, w, h, 40);

  // Step 3: divide by background -> shadows-out, paper goes white.
  for (let p = 0, i = 0; p < gray.length; p++, i += 4) {
    const bg = Math.max(1, background[p]!);
    const scale = 255 / bg;
    data[i] = clamp255(data[i]! * scale);
    data[i + 1] = clamp255(data[i + 1]! * scale);
    data[i + 2] = clamp255(data[i + 2]! * scale);
  }

  // Step 4: gray-world WB.
  let sumR = 0,
    sumG = 0,
    sumB = 0;
  const n = w * h;
  for (let i = 0; i < data.length; i += 4) {
    sumR += data[i]!;
    sumG += data[i + 1]!;
    sumB += data[i + 2]!;
  }
  const meanR = sumR / n;
  const meanG = sumG / n;
  const meanB = sumB / n;
  const meanLuma = (meanR + meanG + meanB) / 3;
  const gainR = meanR > 0 ? meanLuma / meanR : 1;
  const gainG = meanG > 0 ? meanLuma / meanG : 1;
  const gainB = meanB > 0 ? meanLuma / meanB : 1;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = clamp255(data[i]! * gainR);
    data[i + 1] = clamp255(data[i + 1]! * gainG);
    data[i + 2] = clamp255(data[i + 2]! * gainB);
  }

  // Step 5: unsharp mask with radius=2. Build per-channel blurred buffers.
  const r = 2;
  const ch = new Uint8ClampedArray(w * h);
  for (let c = 0; c < 3; c++) {
    for (let p = 0, i = c; p < n; p++, i += 4) ch[p] = data[i]!;
    const blurC = boxBlur(ch, w, h, r);
    for (let p = 0, i = c; p < n; p++, i += 4) {
      data[i] = clamp255(1.4 * ch[p]! - 0.4 * blurC[p]!);
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
