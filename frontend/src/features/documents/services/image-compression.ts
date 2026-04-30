import imageCompression from "browser-image-compression";

export interface CompressOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  quality?: number;
}

export async function compressImage(file: File, opts: CompressOptions = {}): Promise<File> {
  return imageCompression(file, {
    maxSizeMB: opts.maxSizeMB ?? 1,
    maxWidthOrHeight: opts.maxWidthOrHeight ?? 1800,
    initialQuality: opts.quality ?? 0.85,
    useWebWorker: true,
    fileType: "image/jpeg",
  });
}

export async function compressBlob(blob: Blob, filename = "image.jpg", opts: CompressOptions = {}): Promise<File> {
  const file = new File([blob], filename, { type: blob.type || "image/jpeg" });
  return compressImage(file, opts);
}
