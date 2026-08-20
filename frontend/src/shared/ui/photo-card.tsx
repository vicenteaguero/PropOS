import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Clickable card with a photo band above its body.
 *
 * The band — image, absolutely-positioned overlay slots — was copy-pasted
 * between the admin property list and the owner's home. The two cards carry
 * different data (a `Property` vs a `PropertyGrant`) and different overlays, so
 * only the shell is shared; everything variable is a slot.
 *
 * `src` should be a derivative (~800px), never a full-resolution original: this
 * renders once per row in a grid that can hold a hundred of them.
 */
export function PhotoCard({
  onClick,
  src,
  alt,
  overlay,
  children,
  className,
}: {
  onClick: () => void;
  /** Cover image. Falls back to the gradient band when absent or broken. */
  src?: string | null;
  alt?: string;
  /** Absolutely-positioned content over the photo band (badges, icons). */
  overlay?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  // Signed URLs expire, and a backfill can lag behind: a 404 must degrade to the
  // placeholder rather than leave a broken-image glyph in the grid.
  const [broken, setBroken] = useState(false);
  const showImage = !!src && !broken;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "block w-full overflow-hidden rounded-xl bg-card text-left transition active:scale-[0.99]",
        className,
      )}
    >
      <div className="relative h-40 w-full bg-gradient-to-br from-secondary to-muted text-foreground">
        {showImage ? (
          <img
            src={src}
            alt={alt ?? ""}
            loading="lazy"
            decoding="async"
            sizes="(min-width: 1536px) 25vw, (min-width: 1024px) 33vw, 100vw"
            onError={() => setBroken(true)}
            className="size-full object-cover"
          />
        ) : (
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, currentColor 0 12px, transparent 12px 24px)",
            }}
          />
        )}
        {overlay}
      </div>
      {children}
    </button>
  );
}
