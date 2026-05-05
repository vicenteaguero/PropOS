import { outputSize } from "./geometry";
import type { Quad } from "./types";

// Solve 8x8 linear system for perspective transform coefficients via Gaussian
// elimination. Returns [a,b,c,d,e,f,g,h] where the homography is:
//   x' = (ax + by + c) / (gx + hy + 1)
//   y' = (dx + ey + f) / (gx + hy + 1)
function solveHomography(src: Quad, dst: Quad): number[] {
  const A: number[][] = [];
  const B: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x: sx, y: sy } = src[i]!;
    const { x: dx, y: dy } = dst[i]!;
    A.push([sx, sy, 1, 0, 0, 0, -dx * sx, -dx * sy]);
    B.push(dx);
    A.push([0, 0, 0, sx, sy, 1, -dy * sx, -dy * sy]);
    B.push(dy);
  }
  // Gaussian elimination with partial pivoting.
  for (let i = 0; i < 8; i++) {
    let maxRow = i;
    for (let k = i + 1; k < 8; k++) {
      if (Math.abs(A[k]![i]!) > Math.abs(A[maxRow]![i]!)) maxRow = k;
    }
    [A[i], A[maxRow]] = [A[maxRow]!, A[i]!];
    [B[i], B[maxRow]] = [B[maxRow]!, B[i]!];
    for (let k = i + 1; k < 8; k++) {
      const f = A[k]![i]! / A[i]![i]!;
      for (let j = i; j < 8; j++) A[k]![j]! -= f * A[i]![j]!;
      B[k]! -= f * B[i]!;
    }
  }
  const x = new Array<number>(8);
  for (let i = 7; i >= 0; i--) {
    let sum = B[i]!;
    for (let j = i + 1; j < 8; j++) sum -= A[i]![j]! * x[j]!;
    x[i] = sum / A[i]![i]!;
  }
  return x;
}

/**
 * Pure-canvas perspective warp. Renders the destination via 2D triangle
 * subdivision so the work happens on the GPU through drawImage transforms.
 * No OpenCV dependency, no WASM, no main-thread stalls on mobile.
 */
export async function warpQuad(bitmap: ImageBitmap, quad: Quad): Promise<HTMLCanvasElement> {
  const { width: W, height: H } = outputSize(quad);
  const portrait = W <= H;
  const outW = portrait ? W : H;
  const outH = portrait ? H : W;

  // Solve homography (unit square -> source quad) so each grid sample is the
  // true perspective-correct source location for a regular destination grid.
  const N = 32;
  const grid: { x: number; y: number }[][] = [];
  const unit: Quad = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ];
  const h = solveHomography(unit, quad);
  const map = (u: number, v: number) => {
    const denom = h[6]! * u + h[7]! * v + 1;
    return {
      x: (h[0]! * u + h[1]! * v + h[2]!) / denom,
      y: (h[3]! * u + h[4]! * v + h[5]!) / denom,
    };
  };
  for (let i = 0; i <= N; i++) {
    const row: { x: number; y: number }[] = [];
    for (let j = 0; j <= N; j++) {
      row.push(map(j / N, i / N));
    }
    grid.push(row);
  }

  const dstMap = (u: number, v: number) => {
    if (portrait) return { x: u * outW, y: v * outH };
    return { x: v * outW, y: (1 - u) * outH };
  };

  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, outW, outH);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // For each grid cell, render source triangle to destination triangle via
  // 2D affine transform (drawImage clipped to triangle).
  const drawTriangle = (
    s0: { x: number; y: number },
    s1: { x: number; y: number },
    s2: { x: number; y: number },
    d0: { x: number; y: number },
    d1: { x: number; y: number },
    d2: { x: number; y: number },
  ) => {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(d0.x, d0.y);
    ctx.lineTo(d1.x, d1.y);
    ctx.lineTo(d2.x, d2.y);
    ctx.closePath();
    ctx.clip();

    // Solve affine: [d] = M [s], 6 unknowns, 6 eqs from 3 point pairs.
    const x0 = s0.x,
      y0 = s0.y,
      x1 = s1.x,
      y1 = s1.y,
      x2 = s2.x,
      y2 = s2.y;
    const X0 = d0.x,
      Y0 = d0.y,
      X1 = d1.x,
      Y1 = d1.y,
      X2 = d2.x,
      Y2 = d2.y;
    const det = x0 * (y1 - y2) + x1 * (y2 - y0) + x2 * (y0 - y1);
    if (Math.abs(det) < 1e-9) {
      ctx.restore();
      return;
    }
    const a = (X0 * (y1 - y2) + X1 * (y2 - y0) + X2 * (y0 - y1)) / det;
    const c = (X0 * (x2 - x1) + X1 * (x0 - x2) + X2 * (x1 - x0)) / det;
    const e =
      (X0 * (x1 * y2 - x2 * y1) + X1 * (x2 * y0 - x0 * y2) + X2 * (x0 * y1 - x1 * y0)) / det;
    const b = (Y0 * (y1 - y2) + Y1 * (y2 - y0) + Y2 * (y0 - y1)) / det;
    const d = (Y0 * (x2 - x1) + Y1 * (x0 - x2) + Y2 * (x1 - x0)) / det;
    const f =
      (Y0 * (x1 * y2 - x2 * y1) + Y1 * (x2 * y0 - x0 * y2) + Y2 * (x0 * y1 - x1 * y0)) / det;
    ctx.transform(a, b, c, d, e, f);
    ctx.drawImage(bitmap, 0, 0);
    ctx.restore();
  };

  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const s00 = grid[i]![j]!;
      const s01 = grid[i]![j + 1]!;
      const s10 = grid[i + 1]![j]!;
      const s11 = grid[i + 1]![j + 1]!;
      const d00 = dstMap(j / N, i / N);
      const d01 = dstMap((j + 1) / N, i / N);
      const d10 = dstMap(j / N, (i + 1) / N);
      const d11 = dstMap((j + 1) / N, (i + 1) / N);
      // Two triangles per cell: (s00, s01, s11) and (s00, s11, s10).
      drawTriangle(s00, s01, s11, d00, d01, d11);
      drawTriangle(s00, s11, s10, d00, d11, d10);
    }
  }

  return out;
}
