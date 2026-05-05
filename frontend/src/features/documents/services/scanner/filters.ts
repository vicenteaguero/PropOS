import { loadOpenCV } from "./opencv-loader";
import type { FilterMode } from "./types";

export async function applyFilter(
  canvas: HTMLCanvasElement,
  mode: FilterMode,
): Promise<HTMLCanvasElement> {
  if (mode === "none") return canvas;
  const cv = (await loadOpenCV()) as any;
  const src = cv.imread(canvas);
  const dst = new cv.Mat();

  try {
    if (mode === "bw") {
      const gray = new cv.Mat();
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      cv.adaptiveThreshold(gray, dst, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 25, 15);
      gray.delete();
    } else if (mode === "enhance") {
      const lab = new cv.Mat();
      cv.cvtColor(src, lab, cv.COLOR_RGB2Lab);
      const channels = new cv.MatVector();
      cv.split(lab, channels);
      const l = channels.get(0);
      const clahe = new cv.CLAHE(1.0, new cv.Size(16, 16));
      const lEq = new cv.Mat();
      clahe.apply(l, lEq);
      channels.set(0, lEq);
      cv.merge(channels, lab);
      cv.cvtColor(lab, dst, cv.COLOR_Lab2RGB);
      // Subtle unsharp mask (gentler than 1.5x to preserve photos on IDs).
      const blur = new cv.Mat();
      cv.GaussianBlur(dst, blur, new cv.Size(0, 0), 1.0);
      cv.addWeighted(dst, 1.2, blur, -0.2, 0, dst);
      lab.delete();
      l.delete();
      lEq.delete();
      blur.delete();
      channels.delete();
      clahe.delete();
    }
    const out = document.createElement("canvas");
    out.width = canvas.width;
    out.height = canvas.height;
    cv.imshow(out, dst);
    return out;
  } finally {
    src.delete();
    dst.delete();
  }
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
