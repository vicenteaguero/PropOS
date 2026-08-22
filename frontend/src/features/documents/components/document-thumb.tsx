import { useEffect, useRef, useState } from "react";
import { FileImage, FileQuestion, FileText, FileType2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { documentsApi } from "../api/documents-api";
import type { DocumentItem } from "../types";

/**
 * The first-page preview, and every way it can fail to be one.
 *
 * Both the grid tile and the list rail render this, which is the point: the
 * card and the row used to carry their own copies of the loading flags and of
 * `iconFor`, and they had already drifted (the list showed no thumbnail at all).
 *
 * The repair path matters more than it looks. Thumbnail URLs are signed and
 * cached inside a list response, so a tab left open long enough holds URLs that
 * have expired and every tile 403s at once. Refetching the list from here would
 * fire one refetch per broken tile; instead each image asks for its own new URL,
 * exactly once. That same call is what generates a thumbnail for a document
 * that has never had one, so both failure modes share one path.
 */
function iconFor(kind: DocumentItem["kind"]) {
  switch (kind) {
    case "PDF":
      return FileText;
    case "DOCX":
      return FileType2;
    case "IMAGE_PDF":
      return FileImage;
    default:
      return FileQuestion;
  }
}

interface DocumentThumbProps {
  doc: DocumentItem;
  /** `tile` fills its aspect box in the grid; `rail` is the fixed 48x64 list slot. */
  variant: "tile" | "rail";
  className?: string;
}

export function DocumentThumb({ doc, variant, className }: DocumentThumbProps) {
  const Icon = iconFor(doc.kind);
  const initial = doc.current_version?.thumbnail_url ?? null;
  const [src, setSrc] = useState<string | null>(initial);
  const [loaded, setLoaded] = useState(false);
  const [dead, setDead] = useState(false);
  // One repair per mounted image. Without this a URL that 403s repeatedly would
  // loop: fetch, set, fail, fetch.
  const repaired = useRef(false);

  // A new list response brings new signed URLs; adopt them and start over.
  useEffect(() => {
    setSrc(initial);
    setLoaded(false);
    setDead(false);
    repaired.current = false;
  }, [initial]);

  // A document with no thumbnail yet has nothing to try, so it has to ask for
  // one rather than wait for an <img> that will never fire onError. Gated on
  // being on screen: the grid is not virtualized, so without this a folder of
  // sixty un-rendered documents would fire sixty requests on mount, on a phone,
  // to generate previews for tiles below the fold. `loading="lazy"` gives the
  // <img> the same courtesy; this is the equivalent for the fetch.
  const boxRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = boxRef.current;
    if (!el || inView) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && setInView(true),
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [inView]);

  useEffect(() => {
    if (initial || !inView || repaired.current || dead) return;
    repaired.current = true;
    let cancelled = false;
    documentsApi
      .thumbnail(doc.id)
      .then((res) => {
        if (cancelled) return;
        if (res.url) setSrc(res.url);
        else setDead(true);
      })
      .catch(() => !cancelled && setDead(true));
    return () => {
      cancelled = true;
    };
  }, [doc.id, initial, inView, dead]);

  const onError = () => {
    if (repaired.current) {
      setDead(true);
      return;
    }
    repaired.current = true;
    documentsApi
      .thumbnail(doc.id)
      .then((res) => (res.url ? setSrc(res.url) : setDead(true)))
      .catch(() => setDead(true));
  };

  const showImage = Boolean(src) && !dead;
  const box =
    variant === "tile"
      ? "aspect-[4/5] w-full"
      : // Fixed, not intrinsic: the rail must never change width as thumbnails
        // stream in, or the whole virtualized list shivers.
        "h-16 w-12 shrink-0 rounded-md ring-1 ring-border";

  return (
    <div
      ref={boxRef}
      className={cn(
        "relative flex items-center justify-center overflow-hidden bg-secondary",
        box,
        className,
      )}
    >
      {showImage ? (
        <>
          {!loaded && <Skeleton className="absolute inset-0 h-full w-full" />}
          <img
            src={src ?? undefined}
            alt=""
            aria-hidden
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={onError}
            className={cn(
              "h-full w-full object-cover transition-opacity",
              loaded ? "opacity-100" : "opacity-0",
            )}
          />
        </>
      ) : (
        <Icon
          className={cn("text-muted-foreground", variant === "tile" ? "size-10" : "size-5")}
          strokeWidth={1.4}
        />
      )}
    </div>
  );
}
