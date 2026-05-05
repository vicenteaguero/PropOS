import { loadOpenCV } from "./opencv-loader";
import { outputSize } from "./geometry";
import type { Quad } from "./types";

export async function warpQuad(bitmap: ImageBitmap, quad: Quad): Promise<HTMLCanvasElement> {
  const cv = (await loadOpenCV()) as any;
  const { width, height } = outputSize(quad);

  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = bitmap.width;
  sourceCanvas.height = bitmap.height;
  const sctx = sourceCanvas.getContext("2d");
  if (!sctx) throw new Error("2d context unavailable");
  sctx.drawImage(bitmap, 0, 0);

  const src = cv.imread(sourceCanvas);
  const dst = new cv.Mat();
  const dsize = new cv.Size(width, height);

  const srcPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
    quad[0].x,
    quad[0].y,
    quad[1].x,
    quad[1].y,
    quad[2].x,
    quad[2].y,
    quad[3].x,
    quad[3].y,
  ]);
  const dstPts = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, width, 0, width, height, 0, height]);
  const M = cv.getPerspectiveTransform(srcPts, dstPts);

  try {
    cv.warpPerspective(src, dst, M, dsize, cv.INTER_LINEAR, cv.BORDER_REPLICATE, new cv.Scalar());
    // Always-portrait policy: rotate 90° CCW if landscape, so PDF pages
    // stay consistent (Letter portrait everywhere).
    let finalMat = dst;
    let rotated: any = null;
    if (width > height) {
      rotated = new cv.Mat();
      cv.rotate(dst, rotated, cv.ROTATE_90_COUNTERCLOCKWISE);
      finalMat = rotated;
    }
    const out = document.createElement("canvas");
    out.width = finalMat.cols;
    out.height = finalMat.rows;
    cv.imshow(out, finalMat);
    if (rotated) rotated.delete();
    return out;
  } finally {
    src.delete();
    dst.delete();
    srcPts.delete();
    dstPts.delete();
    M.delete();
  }
}
