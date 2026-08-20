import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { TOUCH_TARGET_HIT_AREA } from "@shared/ui";

export interface PhotoGridItem {
  id: string;
  /** Derivative to render (~400px). Never the full-resolution original. */
  url: string;
  alt?: string;
}

interface PhotoGridProps {
  photos: PhotoGridItem[];
  onPhotoClick: (index: number) => void;
  /**
   * `strip` is one horizontally-scrolling row — the gallery's default, so the
   * page reaches its title instead of spending the whole viewport on photos.
   * `grid` wraps, and is what the manage mode needs to show every photo at once.
   */
  layout?: "strip" | "grid";
  /** When given, each tile carries a remove button. */
  onRemove?: (id: string) => void;
  removeDisabled?: boolean;
  className?: string;
}

export function PhotoGrid({
  photos,
  onPhotoClick,
  layout = "grid",
  onRemove,
  removeDisabled,
  className,
}: PhotoGridProps) {
  if (photos.length === 0) return null;

  const strip = layout === "strip";

  return (
    <div
      className={cn(
        strip
          ? "-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          : "grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6",
        className,
      )}
    >
      {photos.map((photo, index) => (
        <div
          key={photo.id}
          className={cn(
            "group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted",
            strip && "w-24 shrink-0 snap-start sm:w-28",
          )}
        >
          <button
            type="button"
            className="block size-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => onPhotoClick(index)}
          >
            <img
              src={photo.url}
              alt={photo.alt ?? `Foto ${index + 1}`}
              className="size-full object-cover transition-transform group-hover:scale-105"
              loading="lazy"
              decoding="async"
              sizes={strip ? "112px" : "(min-width: 1024px) 16vw, 33vw"}
            />
          </button>
          {onRemove && (
            <button
              type="button"
              aria-label="Eliminar foto"
              disabled={removeDisabled}
              onClick={() => onRemove(photo.id)}
              className={cn(
                "absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm transition active:scale-95 disabled:opacity-60",
                TOUCH_TARGET_HIT_AREA,
              )}
            >
              <X className="size-4" strokeWidth={2} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
