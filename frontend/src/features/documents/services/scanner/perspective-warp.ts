import { outputSize } from "./geometry";
import type { Point, Quad } from "./types";

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

const VERTEX_SHADER = `#version 300 es
in vec2 aPos;
out vec2 vUV;
void main() {
  // aPos in clip space [-1,1]; UV maps to [0,1] for destination.
  vUV = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 outColor;
uniform sampler2D uTex;
uniform mat3 uH;
uniform vec2 uTexSize;
void main() {
  vec3 p = uH * vec3(vUV, 1.0);
  vec2 srcUV = (p.xy / p.z) / uTexSize;
  outColor = texture(uTex, srcUV);
}`;

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const sh = gl.createShader(type);
  if (!sh) throw new Error("createShader failed");
  gl.shaderSource(sh, source);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh) ?? "unknown";
    gl.deleteShader(sh);
    throw new Error(`shader compile failed: ${log}`);
  }
  return sh;
}

function tryWebGLWarp(
  bitmap: ImageBitmap,
  quad: Quad,
  naturalW: number,
  naturalH: number,
): HTMLCanvasElement | null {
  const canvas = document.createElement("canvas");
  canvas.width = naturalW;
  canvas.height = naturalH;
  const gl = canvas.getContext("webgl2", {
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,
  });
  if (!gl) return null;

  let program: WebGLProgram | null = null;
  let vbo: WebGLBuffer | null = null;
  let texture: WebGLTexture | null = null;

  try {
    const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    program = gl.createProgram();
    if (!program) throw new Error("createProgram failed");
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`link failed: ${gl.getProgramInfoLog(program) ?? ""}`);
    }
    gl.useProgram(program);

    // Quad covering clip space.
    const verts = new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]);
    vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    // Texture.
    texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Homography unit-square -> source quad (in pixel coords).
    const unit: Quad = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
    const h = solveHomography(unit, quad);
    // mat3 column-major: columns are [a,d,g], [b,e,h], [c,f,1].
    const mat = new Float32Array([h[0]!, h[3]!, h[6]!, h[1]!, h[4]!, h[7]!, h[2]!, h[5]!, 1]);
    const uH = gl.getUniformLocation(program, "uH");
    const uTexSize = gl.getUniformLocation(program, "uTexSize");
    const uTex = gl.getUniformLocation(program, "uTex");
    gl.uniformMatrix3fv(uH, false, mat);
    gl.uniform2f(uTexSize, bitmap.width, bitmap.height);
    gl.uniform1i(uTex, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.viewport(0, 0, naturalW, naturalH);
    gl.clearColor(1, 1, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);

    return canvas;
  } catch {
    return null;
  } finally {
    if (texture) gl.deleteTexture(texture);
    if (vbo) gl.deleteBuffer(vbo);
    if (program) gl.deleteProgram(program);
  }
}

function fallback2DWarp(
  bitmap: ImageBitmap,
  quad: Quad,
  outW: number,
  outH: number,
  portrait: boolean,
): HTMLCanvasElement {
  const N = 64;
  const unit: Quad = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ];
  const h = solveHomography(unit, quad);
  const map = (u: number, v: number): Point => {
    const denom = h[6]! * u + h[7]! * v + 1;
    return {
      x: (h[0]! * u + h[1]! * v + h[2]!) / denom,
      y: (h[3]! * u + h[4]! * v + h[5]!) / denom,
    };
  };
  const grid: Point[][] = [];
  for (let i = 0; i <= N; i++) {
    const row: Point[] = [];
    for (let j = 0; j <= N; j++) row.push(map(j / N, i / N));
    grid.push(row);
  }
  const dstMap = (u: number, v: number): Point => {
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

  // Dilate destination triangle by +0.5px from centroid to hide AA seams.
  const dilate = (p: Point, c: Point): Point => {
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return p;
    const k = (len + 0.5) / len;
    return { x: c.x + dx * k, y: c.y + dy * k };
  };

  const drawTriangle = (s0: Point, s1: Point, s2: Point, d0: Point, d1: Point, d2: Point) => {
    const cx = (d0.x + d1.x + d2.x) / 3;
    const cy = (d0.y + d1.y + d2.y) / 3;
    const c = { x: cx, y: cy };
    const D0 = dilate(d0, c);
    const D1 = dilate(d1, c);
    const D2 = dilate(d2, c);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(D0.x, D0.y);
    ctx.lineTo(D1.x, D1.y);
    ctx.lineTo(D2.x, D2.y);
    ctx.closePath();
    ctx.clip();
    const x0 = s0.x,
      y0 = s0.y,
      x1 = s1.x,
      y1 = s1.y,
      x2 = s2.x,
      y2 = s2.y;
    const X0 = D0.x,
      Y0 = D0.y,
      X1 = D1.x,
      Y1 = D1.y,
      X2 = D2.x,
      Y2 = D2.y;
    const det = x0 * (y1 - y2) + x1 * (y2 - y0) + x2 * (y0 - y1);
    if (Math.abs(det) < 1e-9) {
      ctx.restore();
      return;
    }
    const a = (X0 * (y1 - y2) + X1 * (y2 - y0) + X2 * (y0 - y1)) / det;
    const cAff = (X0 * (x2 - x1) + X1 * (x0 - x2) + X2 * (x1 - x0)) / det;
    const e =
      (X0 * (x1 * y2 - x2 * y1) + X1 * (x2 * y0 - x0 * y2) + X2 * (x0 * y1 - x1 * y0)) / det;
    const b = (Y0 * (y1 - y2) + Y1 * (y2 - y0) + Y2 * (y0 - y1)) / det;
    const d = (Y0 * (x2 - x1) + Y1 * (x0 - x2) + Y2 * (x1 - x0)) / det;
    const f =
      (Y0 * (x1 * y2 - x2 * y1) + Y1 * (x2 * y0 - x0 * y2) + Y2 * (x0 * y1 - x1 * y0)) / det;
    ctx.transform(a, b, cAff, d, e, f);
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
      drawTriangle(s00, s01, s11, d00, d01, d11);
      drawTriangle(s00, s11, s10, d00, d11, d10);
    }
  }
  return out;
}

/**
 * GPU perspective warp via WebGL2. Renders in natural orientation, then copies
 * into a 2D canvas, rotating to portrait when source is landscape so PDF output
 * stays portrait. Falls back to a triangulated 2D canvas warp when WebGL2 is
 * unavailable.
 */
export async function warpQuad(bitmap: ImageBitmap, quad: Quad): Promise<HTMLCanvasElement> {
  const { width: W, height: H } = outputSize(quad);
  const portrait = W <= H;
  // Final 2D output is always portrait-or-square (W <= H).
  const outW = portrait ? W : H;
  const outH = portrait ? H : W;

  // Render in natural orientation (W x H, possibly landscape) on the GL canvas.
  const glCanvas = tryWebGLWarp(bitmap, quad, W, H);

  if (!glCanvas) {
    return fallback2DWarp(bitmap, quad, outW, outH, portrait);
  }

  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, outW, outH);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  if (portrait) {
    ctx.drawImage(glCanvas, 0, 0, outW, outH);
  } else {
    // Landscape source -> rotate -90deg into portrait output.
    // Map (x, y) in W x H source to (y, W - x) in outW x outH (= H x W).
    ctx.save();
    ctx.translate(0, outH);
    ctx.rotate(-Math.PI / 2);
    ctx.drawImage(glCanvas, 0, 0, W, H);
    ctx.restore();
  }

  return out;
}
