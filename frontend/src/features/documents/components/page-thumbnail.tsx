import { useEffect, useState } from "react";
import { Document, Page } from "react-pdf";

interface Props {
  blob: Blob;
  pageIndex: number;
  width?: number;
}

export function PageThumbnail({ blob, pageIndex, width = 120 }: Props) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(blob);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  if (!src) return null;
  return (
    <Document file={src} loading={<div className="h-32 w-24 animate-pulse rounded bg-muted" />}>
      <Page pageNumber={pageIndex + 1} width={width} renderAnnotationLayer={false} renderTextLayer={false} />
    </Document>
  );
}
