export type Point = { x: number; y: number };

export type Quad = [Point, Point, Point, Point];

export type Corner = "TL" | "TR" | "BR" | "BL";
export type Side = "T" | "R" | "B" | "L";

export type FilterMode = "none" | "bw" | "enhance";

export interface EditState {
  quad: Quad;
  filter: FilterMode;
  autoDetected: boolean;
  sourceWidth: number;
  sourceHeight: number;
}

export interface HitResult {
  kind: "corner" | "side" | "zone";
  corner?: Corner;
  side?: Side;
}
