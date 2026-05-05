import { loadOpenCV } from "./opencv-loader";
import { insetRect, orderQuad } from "./geometry";
import type { Point, Quad } from "./types";

const MAX_DIM = 1200;

/**
 * jscanify-style detection: Canny → blur → Otsu → biggest contour → 4-quadrant
 * farthest point. Robust to rounded corners and plastic-card glare. Caps the
 * accepted contour at 85% of the image area so the photo frame itself is
 * never picked as the document.
 */
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
  const canny = new cv.Mat();
  const blurred = new cv.Mat();
  const thresh = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();

  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.Canny(gray, canny, 50, 200);
    cv.GaussianBlur(canny, blurred, new cv.Size(3, 3), 0);
    cv.threshold(blurred, thresh, 0, 255, cv.THRESH_OTSU);
    cv.findContours(thresh, contours, hierarchy, cv.RETR_CCOMP, cv.CHAIN_APPROX_SIMPLE);

    const total = w * h;
    const minArea = total * 0.05;
    const maxArea = total * 0.85;

    let best: { contour: any; area: number } | null = null;
    for (let i = 0; i < contours.size(); i++) {
      const c = contours.get(i);
      const area = cv.contourArea(c);
      if (area < minArea || area > maxArea) {
        c.delete();
        continue;
      }
      if (!best || area > best.area) {
        if (best) best.contour.delete();
        best = { contour: c, area };
      } else {
        c.delete();
      }
    }

    if (!best) return { quad: fallback, autoDetected: false };

    const rect = cv.minAreaRect(best.contour);
    const cx = rect.center.x;
    const cy = rect.center.y;
    const data = best.contour.data32S;

    let tl: Point | null = null,
      tr: Point | null = null,
      bl: Point | null = null,
      br: Point | null = null;
    let tld = -1,
      trd = -1,
      bld = -1,
      brd = -1;
    for (let i = 0; i < data.length; i += 2) {
      const x = data[i]!;
      const y = data[i + 1]!;
      const dx = x - cx;
      const dy = y - cy;
      const d = dx * dx + dy * dy;
      if (x < cx && y < cy) {
        if (d > tld) {
          tld = d;
          tl = { x: x / scale, y: y / scale };
        }
      } else if (x > cx && y < cy) {
        if (d > trd) {
          trd = d;
          tr = { x: x / scale, y: y / scale };
        }
      } else if (x < cx && y > cy) {
        if (d > bld) {
          bld = d;
          bl = { x: x / scale, y: y / scale };
        }
      } else if (x > cx && y > cy) {
        if (d > brd) {
          brd = d;
          br = { x: x / scale, y: y / scale };
        }
      }
    }

    best.contour.delete();

    if (!tl || !tr || !bl || !br) return { quad: fallback, autoDetected: false };
    return { quad: orderQuad([tl, tr, br, bl]), autoDetected: true };
  } finally {
    src.delete();
    gray.delete();
    canny.delete();
    blurred.delete();
    thresh.delete();
    contours.delete();
    hierarchy.delete();
  }
}
