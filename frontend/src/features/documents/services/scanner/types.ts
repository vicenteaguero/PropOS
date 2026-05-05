export type Point = { x: number; y: number };

export type Quad = [Point, Point, Point, Point];

export type Corner = "TL" | "TR" | "BR" | "BL";
export type Side = "T" | "R" | "B" | "L";

export type FilterMode = "none" | "magic" | "color" | "bw" | "ink" | "enhance";

export interface EditState {
  quad: Quad;
  filter: FilterMode;
  autoDetected: boolean;
  sourceWidth: number;
  sourceHeight: number;
  /** Optional bow controls. Each side has a single control point (in image coords)
   * that pulls the side's bezier midpoint. When undefined, the side renders as a
   * straight line (current behavior). */
  bezierControls?: { T?: Point; R?: Point; B?: Point; L?: Point };
}

export interface HitResult {
  kind: "corner" | "side" | "zone";
  corner?: Corner;
  side?: Side;
}
