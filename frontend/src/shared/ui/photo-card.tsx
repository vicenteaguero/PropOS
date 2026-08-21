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
  onIntent,
  src,
  srcThumb,
  alt,
  overlay,
  children,
  className,
}: {
  onClick: () => void;
  /** Hover/focus. Used to prefetch what the click will open. */
  onIntent?: () => void;
  /** Cover image. Falls back to the gradient band when absent or broken. */
  src?: string | null;
  /** 400px derivative of the same photo, offered to narrow viewports. */
  srcThumb?: string | null;
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
      onMouseEnter={onIntent}
      onFocus={onIntent}
      className={cn(
        "block w-full overflow-hidden rounded-xl bg-card text-left transition active:scale-[0.99]",
        className,
      )}
    >
      {/* 4:3 rather than a fixed 160px: at half width on a phone a fixed height
          is nearly square and wastes the row; a ratio keeps the crop honest at
          every column count. */}
      <div className="relative aspect-[4/3] w-full bg-gradient-to-br from-secondary to-muted text-foreground">
        {showImage ? (
          <img
            src={src}
            alt={alt ?? ""}
            loading="lazy"
            decoding="async"
            // `sizes` was here on its own, which does nothing: without a
            // `srcSet` the browser has one candidate and no choice to make. Now
            // a phone can take the 400px file where it used to fetch the 800px
            // one for a half-width tile.
            srcSet={srcThumb ? `${srcThumb} 400w, ${src} 800w` : undefined}
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
