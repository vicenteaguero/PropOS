import { useMemo, useRef, useState, type ReactNode } from "react";
import { ImagePlus, Loader2, Images, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@shared/ui";
import { PhotoGrid } from "@shared/components/photo-grid/photo-grid";
import { PhotoViewer } from "@shared/components/photo-viewer/photo-viewer";
import { cn } from "@/lib/utils";
import {
  useDeletePropertyPhoto,
  usePropertyPhotos,
  useUploadPropertyPhotos,
} from "../hooks/use-property-photos";

interface PropertyGalleryProps {
  propertyId: string;
  /** Badges laid over the hero image (operation, draft…). */
  overlay?: ReactNode;
  className?: string;
}

const HERO_CLASS = "relative h-52 w-full overflow-hidden rounded-xl lg:h-72";

/**
 * Property photo gallery: hero + thumbnail strip + lightbox, with upload and
 * removal. Reads the same `media_assets` rows the agent writes when a broker
 * sends photos over WhatsApp, so both sources land in one place.
 *
 * The thumbnails scroll horizontally rather than wrapping: the previous grid
 * laid every remaining photo out square, so a property with twelve photos
 * pushed its own title a full viewport down the page. Only the lightbox loads
 * originals — the hero takes the `card` derivative, the strip takes `thumb`.
 */
export function PropertyGallery({ propertyId, overlay, className }: PropertyGalleryProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [managing, setManaging] = useState(false);

  const { data: photos, isLoading, error, refetch } = usePropertyPhotos(propertyId);
  const upload = useUploadPropertyPhotos(propertyId);
  const remove = useDeletePropertyPhoto(propertyId);

  const items = useMemo(() => photos ?? [], [photos]);
  const hero = items[0];
  const slides = useMemo(() => items.map((p) => ({ src: p.url })), [items]);
  // Manage mode shows every photo (the hero included, or it could never be
  // deleted); browsing shows the rest, since the hero is already on screen.
  const tiles = useMemo(
    () =>
      (managing ? items : items.slice(1)).map((p) => ({
        id: p.id,
        url: p.thumb_url || p.url,
        alt: p.title ?? undefined,
      })),
    [items, managing],
  );

  const handleFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    await upload.mutateAsync(files);
  };

  const uploadButton = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-1.5"
      disabled={upload.isPending}
      onClick={() => inputRef.current?.click()}
    >
      {upload.isPending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <ImagePlus className="size-4" strokeWidth={1.8} />
      )}
      {upload.isPending ? "Subiendo…" : "Agregar fotos"}
    </Button>
  );

  return (
    <div className={cn("space-y-3", className)}>
      <input
        aria-label="Seleccionar fotos de la propiedad"
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFiles}
      />

      {isLoading && <Skeleton className={cn(HERO_CLASS, "block")} />}

      {!isLoading && error && (
        <ErrorState message="No se pudieron cargar las fotos." onRetry={() => refetch()} compact />
      )}

      {!isLoading && !error && items.length === 0 && (
        <div
          className={cn(
            HERO_CLASS,
            "flex flex-col items-center justify-center gap-3 border border-dashed border-border bg-secondary/40 px-6 text-center",
          )}
        >
          {overlay && (
            <div className="absolute left-3 top-3 flex items-center gap-2">{overlay}</div>
          )}
          <Images className="size-7 text-muted-foreground" strokeWidth={1.6} />
          <p className="text-[13px] text-muted-foreground">
            Sin fotos todavía. Súbelas aquí o mándaselas a Propo por WhatsApp.
          </p>
          {uploadButton}
        </div>
      )}

      {!isLoading && !error && hero && (
        <>
          <button
            type="button"
            className={cn(HERO_CLASS, "block bg-secondary")}
            onClick={() => setViewerIndex(0)}
          >
            <img
              src={hero.card_url || hero.url}
              alt={hero.title ?? "Foto principal"}
              className="size-full object-cover"
              decoding="async"
              sizes="(min-width: 1024px) 50vw, 100vw"
            />
            {overlay && (
              <span className="absolute left-3 top-3 flex items-center gap-2">{overlay}</span>
            )}
          </button>

          {/* One component for both modes: the manage view used to be a second,
              drifting copy of the same grid. */}
          <PhotoGrid
            photos={tiles}
            layout={managing ? "grid" : "strip"}
            onPhotoClick={(index) => setViewerIndex(managing ? index : index + 1)}
            onRemove={managing ? (id) => remove.mutate(id) : undefined}
            removeDisabled={remove.isPending}
          />

          <div className="flex items-center gap-2">
            {uploadButton}
            <Button
              type="button"
              variant={managing ? "secondary" : "ghost"}
              size="sm"
              className="gap-1.5"
              onClick={() => setManaging((v) => !v)}
            >
              <Trash2 className="size-4" strokeWidth={1.8} />
              {managing ? "Listo" : "Eliminar fotos"}
            </Button>
            <span className="ml-auto text-[12px] text-muted-foreground">
              {items.length} {items.length === 1 ? "foto" : "fotos"}
            </span>
          </div>
        </>
      )}

      <PhotoViewer
        open={viewerIndex !== null}
        onClose={() => setViewerIndex(null)}
        slides={slides}
        index={viewerIndex ?? 0}
      />
    </div>
  );
}
