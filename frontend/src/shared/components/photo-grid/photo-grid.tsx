interface PhotoGridProps {
  photos: { id: string; url: string }[];
  onPhotoClick: (index: number) => void;
}

export function PhotoGrid({ photos, onPhotoClick }: PhotoGridProps) {
  if (photos.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {photos.map((photo, index) => (
        <button
          key={photo.id}
          type="button"
          className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => onPhotoClick(index)}
        >
          <img
            src={photo.url}
            alt={`Foto ${index + 1}`}
            className="size-full object-cover transition-transform group-hover:scale-105"
            loading="lazy"
          />
        </button>
      ))}
    </div>
  );
}
