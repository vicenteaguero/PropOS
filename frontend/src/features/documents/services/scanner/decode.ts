// Decode any input image (HEIC/HEIF/JPEG/PNG/WebP) to ImageBitmap.
// HEIC requires libheif via heic2any; everything else uses native createImageBitmap.

const HEIC_BRANDS = new Set([
  "heic",
  "heix",
  "mif1",
  "msf1",
  "hevc",
  "heim",
  "heis",
  "hevm",
  "hevs",
]);

export interface DecodedImage {
  bitmap: ImageBitmap;
  mime: string;
  asJpegBlob: Blob;
}

async function isHeic(file: Blob): Promise<boolean> {
  if (file.size < 12) return false;
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (head[4] !== 0x66 || head[5] !== 0x74 || head[6] !== 0x79 || head[7] !== 0x70) {
    return false;
  }
  const brand = String.fromCharCode(head[8]!, head[9]!, head[10]!, head[11]!);
  return HEIC_BRANDS.has(brand);
}

type Heic2AnyFn = (opts: {
  blob: Blob;
  toType?: string;
  quality?: number;
}) => Promise<Blob | Blob[]>;

async function heicToJpeg(file: Blob): Promise<Blob> {
  const mod = (await import("heic2any")) as unknown as Heic2AnyFn | { default: Heic2AnyFn };
  const fn: Heic2AnyFn = "default" in mod ? mod.default : mod;
  const out = await fn({ blob: file, toType: "image/jpeg", quality: 0.92 });
  if (Array.isArray(out)) {
    if (out.length === 0) throw new Error("heic2any returned empty array");
    return out[0]!;
  }
  return out;
}

async function bitmapToJpeg(bitmap: ImageBitmap, quality = 0.92): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  ctx.drawImage(bitmap, 0, 0);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/jpeg",
      quality,
    );
  });
}

export async function decodeImage(file: Blob): Promise<DecodedImage> {
  if (await isHeic(file)) {
    const jpeg = await heicToJpeg(file);
    const bitmap = await createImageBitmap(jpeg);
    return { bitmap, mime: "image/jpeg", asJpegBlob: jpeg };
  }
  // Native path: covers JPG/PNG/WebP and Safari-decoded HEIC.
  try {
    const bitmap = await createImageBitmap(file);
    const mime = file.type || "image/jpeg";
    const asJpegBlob = mime === "image/jpeg" ? (file as Blob) : await bitmapToJpeg(bitmap);
    return { bitmap, mime, asJpegBlob };
  } catch {
    // Last-resort: maybe HEIC missed by magic check.
    const jpeg = await heicToJpeg(file);
    const bitmap = await createImageBitmap(jpeg);
    return { bitmap, mime: "image/jpeg", asJpegBlob: jpeg };
  }
}
