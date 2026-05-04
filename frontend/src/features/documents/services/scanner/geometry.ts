import type { Corner, HitResult, Point, Quad, Side } from "./types";

const CORNERS: Corner[] = ["TL", "TR", "BR", "BL"];
const SIDES: Side[] = ["T", "R", "B", "L"];

export function distance(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function orderQuad(pts: Point[]): Quad {
  if (pts.length !== 4) throw new Error("orderQuad needs 4 points");
  const sums = pts.map((p) => p.x + p.y);
  const diffs = pts.map((p) => p.x - p.y);
  const tlIdx = sums.indexOf(Math.min(...sums));
  const brIdx = sums.indexOf(Math.max(...sums));
  const trIdx = diffs.indexOf(Math.max(...diffs));
  const blIdx = diffs.indexOf(Math.min(...diffs));
  const tl = pts[tlIdx]!;
  const tr = pts[trIdx]!;
  const br = pts[brIdx]!;
  const bl = pts[blIdx]!;
  return [tl, tr, br, bl];
}

export function outputSize(quad: Quad): { width: number; height: number } {
  const [tl, tr, br, bl] = quad;
  const width = Math.max(distance(tr, tl), distance(br, bl));
  const height = Math.max(distance(bl, tl), distance(br, tr));
  return { width: Math.round(width), height: Math.round(height) };
}

export function insetRect(width: number, height: number, insetPct = 0.05): Quad {
  const ix = width * insetPct;
  const iy = height * insetPct;
  return [
    { x: ix, y: iy },
    { x: width - ix, y: iy },
    { x: width - ix, y: height - iy },
    { x: ix, y: height - iy },
  ];
}

export function quadCentroid(quad: Quad): Point {
  return {
    x: (quad[0].x + quad[1].x + quad[2].x + quad[3].x) / 4,
    y: (quad[0].y + quad[1].y + quad[2].y + quad[3].y) / 4,
  };
}

export function midSidePoints(quad: Quad): Record<Side, Point> {
  const [tl, tr, br, bl] = quad;
  return {
    T: { x: (tl.x + tr.x) / 2, y: (tl.y + tr.y) / 2 },
    R: { x: (tr.x + br.x) / 2, y: (tr.y + br.y) / 2 },
    B: { x: (br.x + bl.x) / 2, y: (br.y + bl.y) / 2 },
    L: { x: (bl.x + tl.x) / 2, y: (bl.y + tl.y) / 2 },
  };
}

export function cornerIndex(c: Corner): number {
  return CORNERS.indexOf(c);
}

export function sideCorners(s: Side): [Corner, Corner] {
  switch (s) {
    case "T":
      return ["TL", "TR"];
    case "R":
      return ["TR", "BR"];
    case "B":
      return ["BR", "BL"];
    case "L":
      return ["BL", "TL"];
  }
}

export function hitTestZone(point: Point, quad: Quad): Corner {
  const c = quadCentroid(quad);
  const left = point.x < c.x;
  const top = point.y < c.y;
  if (top && left) return "TL";
  if (top && !left) return "TR";
  if (!top && !left) return "BR";
  return "BL";
}

export function hitTest(point: Point, quad: Quad, threshold = 44): HitResult {
  let best: { d: number; corner?: Corner } = { d: Infinity };
  for (const c of CORNERS) {
    const corner = quad[cornerIndex(c)]!;
    const d = distance(point, corner);
    if (d < best.d) best = { d, corner: c };
  }
  if (best.d <= threshold && best.corner) {
    return { kind: "corner", corner: best.corner };
  }
  const mids = midSidePoints(quad);
  let bestSide: { d: number; side?: Side } = { d: Infinity };
  for (const s of SIDES) {
    const d = distance(point, mids[s]);
    if (d < bestSide.d) bestSide = { d, side: s };
  }
  if (bestSide.d <= threshold && bestSide.side) {
    return { kind: "side", side: bestSide.side };
  }
  return { kind: "zone", corner: hitTestZone(point, quad) };
}

export function moveCorner(quad: Quad, corner: Corner, to: Point): Quad {
  const next = quad.map((p) => ({ ...p })) as Quad;
  next[cornerIndex(corner)] = to;
  return next;
}

export function moveSide(quad: Quad, side: Side, delta: Point): Quad {
  const [a, b] = sideCorners(side);
  const next = quad.map((p) => ({ ...p })) as Quad;
  for (const c of [a, b]) {
    const i = cornerIndex(c);
    const cur = next[i]!;
    next[i] = { x: cur.x + delta.x, y: cur.y + delta.y };
  }
  return next;
}

export function clampQuad(quad: Quad, width: number, height: number): Quad {
  return quad.map((p) => ({
    x: Math.max(0, Math.min(width, p.x)),
    y: Math.max(0, Math.min(height, p.y)),
  })) as Quad;
}
