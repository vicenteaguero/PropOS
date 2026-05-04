/* eslint-disable @typescript-eslint/no-explicit-any */
import { loadOpenCV } from "./opencv-loader";
import { insetRect, orderQuad } from "./geometry";
import type { Point, Quad } from "./types";

const MAX_DIM = 800;

export async function detectCorners(bitmap: ImageBitmap): Promise<{
  quad: Quad;
  autoDetected: boolean;
}> {
  const cv = (await loadOpenCV()) as any;

  const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const fallback = insetRect(bitmap.width, bitmap.height, 0.05);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { quad: fallback, autoDetected: false };
  ctx.drawImage(bitmap, 0, 0, w, h);

  const src = cv.imread(canvas);
  const gray = new cv.Mat();
  const blurred = new cv.Mat();
  const edges = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();

  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
    cv.Canny(blurred, edges, 50, 150);
    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    const total = w * h;
    const minArea = total * 0.2;
    type Candidate = { area: number; pts: Point[] };
    const candidates: Candidate[] = [];

    for (let i = 0; i < contours.size(); i++) {
      const c = contours.get(i);
      const area = cv.contourArea(c);
      if (area < minArea) {
        c.delete();
        continue;
      }
      const peri = cv.arcLength(c, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(c, approx, 0.02 * peri, true);
      if (approx.rows === 4 && cv.isContourConvex(approx)) {
        const pts: Point[] = [];
        for (let r = 0; r < 4; r++) {
          pts.push({
            x: approx.data32S[r * 2] / scale,
            y: approx.data32S[r * 2 + 1] / scale,
          });
        }
        candidates.push({ area, pts });
      }
      approx.delete();
      c.delete();
    }

    if (candidates.length === 0) {
      return { quad: fallback, autoDetected: false };
    }
    candidates.sort((a, b) => b.area - a.area);
    return { quad: orderQuad(candidates[0]!.pts), autoDetected: true };
  } finally {
    src.delete();
    gray.delete();
    blurred.delete();
    edges.delete();
    contours.delete();
    hierarchy.delete();
  }
}
